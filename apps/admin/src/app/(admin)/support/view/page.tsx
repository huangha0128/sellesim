'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessagesSquare, Send, CheckCircle2, User, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { adminApi, unwrap, getErrorMessage, type SupportSession, type SupportMessage } from '@/api';
import { getToken } from '@/lib/auth';

const SENDER_META: Record<string, { name: string; align: string; bubble: string }> = {
  user: { name: '用户', align: 'items-start', bubble: 'bg-primary/10 text-ink' },
  ai: { name: 'AI 客服', align: 'items-start', bubble: 'bg-blue-50 text-ink' },
  admin: { name: '客服', align: 'items-end', bubble: 'bg-primary text-white' },
  system: { name: '系统', align: 'items-center', bubble: 'bg-muted text-muted-foreground' },
};

function timeStr(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

// 归一化消息图片字段（可能是 JSON 字符串或数组），返回 URL 数组
function msgImgs(m: SupportMessage): string[] {
  const raw = m.images as any;
  if (!raw) return [];
  const arr = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}

export default function SupportViewPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [user, setUser] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastId = useRef('');
  // 是否停在底部：仅在靠近底部时，新消息到达才自动滚动，避免打断回看历史
  const atBottomRef = useRef(true);

  const scrollBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  };

  const isAtBottom = () => {
    const el = msgBoxRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const onScroll = () => {
    atBottomRef.current = isAtBottom();
  };

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const res = await adminApi.getSupportSession(id);
        const body = unwrap<{ session: SupportSession; messages: SupportMessage[]; user: any }>(res);
        setSession(body.data.session);
        setUser(body.data.user);
        if (body.data.messages.length) {
          lastId.current = body.data.messages[body.data.messages.length - 1].id;
        }
        setMessages(body.data.messages);
        if (!silent) scrollBottom();
      } catch (e) {
        if (!silent) toast.error(getErrorMessage(e, '加载会话失败'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  // Keep a ref of current message ids so realtime merge can compare (id-level dedup).
  const messagesRef = useRef<string[]>([]);
  useEffect(() => {
    messagesRef.current = messages.map((m) => m.id);
  }, [messages]);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('id') || '';
    if (!sid) {
      router.replace('/support');
      return;
    }
    setId(sid);
    load();

    // 实时接收新消息：连接 /ws，订阅本会话，按 id 去重合并，替代 3s 轮询
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const ensureWs = () => {
      if (closed || ws) return;
      const token = getToken() || '';
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'subscribe', sessionId: sid }));
      };

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!msg || !msg.type) return;
        if (msg.type === 'messages') {
          if (msg.session) setSession((prev) => (prev ? { ...prev, ...msg.session } : prev));
          const list: SupportMessage[] = msg.messages || [];
          const cur = messagesRef.current;
          const fresh = list.filter((m) => m && m.id && !cur.includes(m.id));
          if (fresh.length) {
            lastId.current = fresh[fresh.length - 1].id;
            setMessages((prev) => [...prev, ...fresh]);
            if (atBottomRef.current) scrollBottom();
          }
        }
        if (msg.type === 'status' && msg.session) {
          setSession((prev) => (prev ? { ...prev, ...msg.session } : prev));
        }
      };

      ws.onerror = () => {
        try { ws?.close(); } catch { /* ignore */ }
      };

      ws.onclose = () => {
        ws = null;
        if (!closed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            ensureWs();
          }, 3000);
        }
      };
    };

    ensureWs();

    // HTTP 轮询兜底：WS 不可达/不稳定时仍能实时刷新。load(true) 全量替换+天然按 id 去重。
    const pollTimer = setInterval(() => load(true), 5000);

    return () => {
      closed = true;
      clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* ignore */ }
      ws = null;
    };
  }, [load, router]);

  const sendReply = async (sendImages: string[] = []) => {
    const content = reply.trim();
    const images = sendImages.length ? sendImages : [];
    if ((!content && !images.length) || sending) return;
    setSending(true);
    try {
      const res = await adminApi.replySupportSession(id, content, images);
      const body = unwrap<{ messages: SupportMessage[] }>(res);
      const sent = body.data.messages || [];
      setMessages((prev) => [...prev, ...sent]);
      setReply('');
      lastId.current = sent.length ? sent[sent.length - 1].id : lastId.current;
      await load(true);
      scrollBottom();
    } catch (e) {
      toast.error(getErrorMessage(e, '回复失败'));
    } finally {
      setSending(false);
    }
  };

  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!file) return;
    setSending(true);
    try {
      const res = await adminApi.adminChatUploadImage(file);
      if (res.code !== 0 || !res.data?.url) throw new Error(res.message || '图片上传失败');
      await sendReply([res.data.url]);
    } catch (err) {
      toast.error(getErrorMessage(err, '图片上传失败'));
      setSending(false);
    }
  };

  const doClose = async () => {
    try {
      await adminApi.closeSupportSession(id);
      toast.success('会话已结束');
      await load(true);
      router.push('/support');
    } catch (e) {
      toast.error(getErrorMessage(e, '结束会话失败'));
    }
  };

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push('/support')}>
          <ArrowLeft size={14} className="mr-1" />
          返回列表
        </Button>
        <h2 className="text-lg font-semibold text-ink">客服会话</h2>
        {session && (
          <Badge
            className={
              session.status === 'human'
                ? 'bg-amber-50 text-amber-600'
                : session.status === 'closed'
                ? 'bg-muted text-muted-foreground'
                : 'bg-blue-50 text-blue-600'
            }
          >
            {session.status === 'ai' ? 'AI 客服' : session.status === 'human' ? '人工' : '已结束'}
          </Badge>
        )}
        {user && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <User size={13} />
            {user.nickname || '用户'} · {user.email || '-'}
          </span>
        )}
        {session && session.status !== 'closed' && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => setConfirmClose(true)}
          >
            <CheckCircle2 size={14} className="mr-1" />
            结束会话
          </Button>
        )}
      </div>

      <Card className="panel-card">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MessagesSquare size={14} />
            会话消息（新消息自动刷新）
          </div>
        </CardHeader>
        <CardContent className="flex h-[60vh] flex-col p-0">
          {/* 消息区 */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4" ref={msgBoxRef} onScroll={onScroll}>
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">暂无消息</p>
            ) : (
              messages.map((m) => {
                const meta = SENDER_META[m.role] || SENDER_META.system;
                const isSystem = m.role === 'system';
                return (
                  <div key={m.id} className={`flex ${meta.align} gap-2`}>
                    <div
                      className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${meta.bubble} ${
                        isSystem ? 'text-center' : ''
                      }`}
                    >
                      {!isSystem && (
                        <div className="mb-1 flex items-center gap-2 text-[11px] opacity-70">
                          <span>{meta.name}</span>
                          <span>{timeStr(m.createdAt)}</span>
                        </div>
                      )}
                      <div className={isSystem ? 'text-[13px]' : 'whitespace-pre-wrap break-words'}>
                        {m.content}
                        {msgImgs(m).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msgImgs(m).map((u) => (
                              <img
                                key={u}
                                src={u}
                                alt="消息图片"
                                className="h-28 w-28 rounded-lg object-cover ring-1 ring-black/5"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* 回复输入区 */}
          {session && session.status !== 'closed' ? (
            <div className="border-t p-3">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={handleAttachImage}
                  disabled={sending}
                  title="发送图片"
                >
                  <Paperclip size={16} />
                </Button>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={'输入回复内容，回车发送（Shift+Enter 换行）'}
                  className="min-h-[64px] flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <Button onClick={() => sendReply()} disabled={sending || !reply.trim()}>
                  <Send size={14} className="mr-1" />
                  发送
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t p-3 text-center text-sm text-muted-foreground">会话已结束</div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>结束该会话？</AlertDialogTitle>
            <AlertDialogDescription>结束后用户将无法继续在聊天中反馈，请确认已解决问题。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={doClose} className="bg-destructive text-white">
              结束会话
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}