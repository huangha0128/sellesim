import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * 在线客服 WebSocket hub。
 *
 * 客户端以 ?token=<JWT>&role=user|admin 建立连接，成功后发送
 *   { "type": "subscribe", "sessionId": "..." }
 * 完成订阅。之后当某会话产生新消息或状态变更时，server 广播给已订阅该 session 的连接：
 *   { "type": "messages", "session": {...}, "messages": [...] }
 *   { "type": "status",   "session": {...} }
 *
 * 订阅鉴权：
 *   - user ：仅能订阅属于自己（userId 匹配）的会话；
 *   - admin：可订阅任意会话（管理后台人工客服）。
 * 兴趣点（sessionId -> 连接 集合）在客户端断开时自动清理。
 */

export type ChatSocket = WebSocket & {
  role?: 'user' | 'admin';
  identity?: string; // userId 或 adminId
  subscribedSessions?: Set<string>;
};

const subscribes = new Map<string, Set<ChatSocket>>(); // sessionId -> sockets

let wss: WebSocketServer | null = null;

export type SubscribeAuth = (socket: ChatSocket, sessionId: string) => Promise<boolean>;
let subscribeAuth: SubscribeAuth = async () => false;

function parseIdentity(token: string) {
  let payload: any;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
  if (payload?.type === 'admin' && payload?.userId) {
    return { role: 'admin' as const, identity: payload.userId };
  }
  if (payload?.userId && !payload?.type) {
    return { role: 'user' as const, identity: payload.userId };
  }
  return null;
}

function wsSend(ws: WebSocket, obj: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function subscribe(socket: ChatSocket, sessionId: string) {
  let set = subscribes.get(sessionId);
  if (!set) {
    set = new Set();
    subscribes.set(sessionId, set);
  }
  set.add(socket);
  socket.subscribedSessions!.add(sessionId);
}

function unsubscribe(socket: ChatSocket, sessionId: string) {
  const set = subscribes.get(sessionId);
  if (set) {
    set.delete(socket);
    if (set.size === 0) subscribes.delete(sessionId);
  }
  socket.subscribedSessions!.delete(sessionId);
}

/** 初始化 ws server，挂在 /ws 路径（noServer 模式，由 index.ts 在 upgrade 事件按路径接管） */
export function initChatHub(server: http.Server, auth: SubscribeAuth) {
  subscribeAuth = auth;
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/ws') return; // 非本服务路径，交由其它处理
    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (rawSocket: WebSocket) => {
    const socket = rawSocket as ChatSocket & { _lastPong: number };
    socket.subscribedSessions = new Set();
    socket._lastPong = Date.now();
    const token = new URL(socket.url, 'http://localhost').searchParams.get('token') || '';
    const identity = parseIdentity(token);
    if (!identity) {
      wsSend(socket, { type: 'error', message: '认证失败' });
      socket.close(1008, 'unauthorized');
      return;
    }
    socket.role = identity.role;
    socket.identity = identity.identity;

    // 心跳：空消息保持连接
    socket.on('message', (data) => {
      socket._lastPong = Date.now();
      if (data.toString() === 'ping') {
        wsSend(socket, { type: 'pong' });
        return;
      }
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      handleClientMessage(socket, msg);
    });

    socket.on('close', () => {
      // 从所有订阅中移除
      if (socket.subscribedSessions) {
        for (const sid of socket.subscribedSessions) unsubscribe(socket, sid);
        socket.subscribedSessions.clear();
      }
    });
  });

  // 心跳超时清理：45s 无任何包则 terminate
  setInterval(() => {
    wss!.clients.forEach((ws) => {
      const s = ws as ChatSocket & { _lastPong?: number };
      if (ws.readyState === WebSocket.OPEN && Date.now() - (s._lastPong || Date.now()) > 45_000) {
        ws.terminate();
      }
    });
  }, 30_000);

  return wss;
}

function handleClientMessage(socket: ChatSocket, msg: any) {
  if (msg.type === 'subscribe') {
    const sessionId = String(msg.sessionId || '');
    if (!sessionId || !socket.role) return;
    // 校验该连接是否有权订阅此会话（user 需归属匹配，admin 放行）。
    subscribeAuth(socket, sessionId)
      .then((ok) => {
        if (!ok || socket.readyState !== WebSocket.OPEN) return;
        if (socket.subscribedSessions!.has(sessionId)) return;
        subscribe(socket, sessionId);
        wsSend(socket, { type: 'subscribed', sessionId });
      })
      .catch(() => {});
    return;
  }

  if (msg.type === 'unsubscribe') {
    const sessionId = String(msg.sessionId || '');
    if (sessionId) unsubscribe(socket, sessionId);
    return;
  }
}

/** 供路由使用：向订阅了某 session 的所有连接广播（消息/会话状态变更，客户端按 id 去重） */
export function broadcastToSession(sessionId: string, payload: unknown) {
  const set = subscribes.get(sessionId);
  if (!set) return;
  for (const ws of set) wsSend(ws, payload);
}