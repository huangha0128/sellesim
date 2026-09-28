'use client';

import { useEffect, useState } from 'react';
import { Bot, Coins, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { adminApi, unwrap, getErrorMessage, type Settings } from '@/api';

const DEFAULT_MAX_REFUND_REJECT_COUNT = 3;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    displayCurrency: 'CNY',
    usdCnyRate: 7,
    maxRefundRejectCount: DEFAULT_MAX_REFUND_REJECT_COUNT,
  });
  const [rateInput, setRateInput] = useState('7');
  const [rejectCountInput, setRejectCountInput] = useState(String(DEFAULT_MAX_REFUND_REJECT_COUNT));
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // AI 客服配置（独立保存）
  const [aiProvider, setAiProvider] = useState<'openai' | 'bailian'>('openai');
  const [aiOpenaiBaseUrl, setAiOpenaiBaseUrl] = useState('');
  const [aiOpenaiApiKey, setAiOpenaiApiKey] = useState('');
  const [aiOpenaiModel, setAiOpenaiModel] = useState('');
  const [aiBailianApiKey, setAiBailianApiKey] = useState('');
  const [aiBailianModel, setAiBailianModel] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState('');

  useEffect(() => {
    adminApi
      .getSettings()
      .then((res) => {
        const data = unwrap<{ settings: Settings }>(res).data.settings;
        setSettings(data);
        setRateInput(String(data.usdCnyRate));
        setRejectCountInput(String(data.maxRefundRejectCount ?? DEFAULT_MAX_REFUND_REJECT_COUNT));
        setAiProvider(data.aiProvider ?? 'openai');
        setAiOpenaiBaseUrl(data.aiOpenaiBaseUrl ?? '');
        setAiOpenaiApiKey(data.aiOpenaiApiKey ?? '');
        setAiOpenaiModel(data.aiOpenaiModel ?? '');
        setAiBailianApiKey(data.aiBailianApiKey ?? '');
        setAiBailianModel(data.aiBailianModel ?? '');
        setAiSystemPrompt(data.aiSystemPrompt ?? '');
      })
      .catch((e) => setErrorMsg(getErrorMessage(e, '读取设置失败')));
  }, []);

  const saveAi = async () => {
    setAiBusy(true);
    setAiErrorMsg('');
    const activeKey = aiProvider === 'openai' ? aiOpenaiApiKey.trim() : aiBailianApiKey.trim();
    const activeModel =
      aiProvider === 'openai' ? aiOpenaiModel.trim() : aiBailianModel.trim();
    if (!activeKey) {
      setAiErrorMsg('请填写所选服务商的 API Key（可暂不启用，置空则 AI 客服自动转人工并提示）');
      setAiBusy(false);
      return;
    }
    if (!activeModel) {
      setAiErrorMsg('请填写所选服务商的模型名称');
      setAiBusy(false);
      return;
    }
    try {
      const res = await adminApi.updateSettings({
        aiProvider,
        aiOpenaiBaseUrl: aiOpenaiBaseUrl.trim(),
        aiOpenaiApiKey: aiProvider === 'openai' ? activeKey : '',
        aiOpenaiModel: aiProvider === 'openai' ? activeModel : '',
        aiBailianApiKey: aiProvider === 'bailian' ? activeKey : '',
        aiBailianModel: aiProvider === 'bailian' ? activeModel : '',
        aiSystemPrompt: aiSystemPrompt.trim(),
      });
      const body = unwrap<unknown>(res);
      if (body.code !== 0) {
        setAiErrorMsg(body.message || '保存失败');
      } else {
        setSettings({ ...settings, aiProvider });
        toast.success('AI 客服配置已保存');
      }
    } catch (e) {
      setAiErrorMsg(getErrorMessage(e, '保存失败'));
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setErrorMsg('');
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setErrorMsg('汇率必须是大于 0 的数字');
      setBusy(false);
      return;
    }
    const maxReject = Number(rejectCountInput);
    if (!Number.isInteger(maxReject) || maxReject < 1) {
      setErrorMsg('退款拒绝次数上限必须是大于等于 1 的整数');
      setBusy(false);
      return;
    }
    try {
      const res = await adminApi.updateSettings({
        displayCurrency: settings.displayCurrency,
        usdCnyRate: rate,
        maxRefundRejectCount: maxReject,
      });
      const body = unwrap<unknown>(res);
      if (body.code !== 0) {
        setErrorMsg(body.message || '保存失败');
      } else {
        setSettings({
          displayCurrency: settings.displayCurrency,
          usdCnyRate: rate,
          maxRefundRejectCount: maxReject,
        });
        toast.success('设置已保存，套餐价格已重新换算');
      }
    } catch (e) {
      setErrorMsg(getErrorMessage(e, '保存失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up grid gap-5 lg:grid-cols-3">
      <Card className="panel-card lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Coins size={16} />
            </span>
            <CardTitle className="text-[15px] text-ink">汇率与展示货币</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-currency">前台展示货币</Label>
              <Select
                value={settings.displayCurrency}
                onValueChange={(v) => setSettings({ ...settings, displayCurrency: v as 'CNY' | 'USD' })}
              >
                <SelectTrigger id="display-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">人民币（¥）</SelectItem>
                  <SelectItem value="USD">美元（$）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[12px] text-muted-foreground">
                小程序与 H5 前台按此货币展示换算后的套餐价格与下单金额。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usd-rate">USD ⇄ CNY 汇率</Label>
              <Input
                id="usd-rate"
                type="number"
                min={0.01}
                step={0.01}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="例如 7"
              />
              <p className="text-[12px] text-muted-foreground">1 美元 = 该数值人民币，用于展示货币换算。</p>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="space-y-2">
            <Label htmlFor="max-reject-count">退款申请被拒绝次数上限</Label>
            <Input
              id="max-reject-count"
              type="number"
              min={1}
              step={1}
              value={rejectCountInput}
              onChange={(e) => setRejectCountInput(e.target.value)}
              placeholder="例如 3"
            />
            <p className="text-[12px] text-muted-foreground">
              用户对同一订单发起退款申请，被后台拒绝的次数达到该上限后，将不能再对该订单发起退款申请。
            </p>
          </div>

          <Separator className="my-5" />

          <div className="flex items-center justify-end gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? '保存中…' : (
                <>
                  <Save size={15} /> 保存设置
                </>
              )}
            </Button>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit panel-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] text-ink">换算规则</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>后台为套餐定价时可选择存储货币（CNY 或 USD）。</li>
            <li>前台展示货币与存储货币相同时价格原样，不同则按汇率换算。</li>
            <li>
              存储 USD 展示 CNY：金额 × 汇率；
              存储 CNY 展示 USD：金额 ÷ 汇率。
            </li>
            <li>保存汇率后套餐价格将即时重新换算，无需重启服务。</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="panel-card lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot size={16} />
            </span>
            <CardTitle className="text-[15px] text-ink">AI 客服配置</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-[12px] text-muted-foreground">
            小程序在线客服由 AI 优先应答；配置为空时自动转人工并提示用户。用户可通过「转人工」按钮或 AI 自动判定升级为人工客服，管理员在「在线客服」页面回复。
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">AI 服务商</Label>
              <Select
                value={aiProvider}
                onValueChange={(v) => setAiProvider(v as 'openai' | 'bailian')}
              >
                <SelectTrigger id="ai-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI（兼容接口）</SelectItem>
                  <SelectItem value="bailian">阿里云百炼（DashScope）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiProvider === 'openai' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ai-openai-base">Base URL（可选）</Label>
                  <Input
                    id="ai-openai-base"
                    value={aiOpenaiBaseUrl}
                    onChange={(e) => setAiOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1（留空使用默认）"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-openai-key">API Key</Label>
                  <Input
                    id="ai-openai-key"
                    type="password"
                    value={aiOpenaiApiKey}
                    onChange={(e) => setAiOpenaiApiKey(e.target.value)}
                    placeholder="sk-…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-openai-model">模型</Label>
                  <Input
                    id="ai-openai-model"
                    value={aiOpenaiModel}
                    onChange={(e) => setAiOpenaiModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ai-bailian-key">API Key</Label>
                  <Input
                    id="ai-bailian-key"
                    type="password"
                    value={aiBailianApiKey}
                    onChange={(e) => setAiBailianApiKey(e.target.value)}
                    placeholder="sk-…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-bailian-model">模型</Label>
                  <Input
                    id="ai-bailian-model"
                    value={aiBailianModel}
                    onChange={(e) => setAiBailianModel(e.target.value)}
                    placeholder="qwen-plus"
                  />
                </div>
              </>
            )}
          </div>

          <Separator className="my-5" />

          <div className="space-y-2">
            <Label htmlFor="ai-system-prompt">系统提示词（可选）</Label>
            <textarea
              id="ai-system-prompt"
              rows={6}
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              placeholder="定义 AI 客服的角色与知识库、转人工判定规则；留空使用内置默认提示词。"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button onClick={saveAi} disabled={aiBusy}>
              {aiBusy ? '保存中…' : (
                <>
                  <Save size={15} /> 保存 AI 配置
                </>
              )}
            </Button>
          </div>

          {aiErrorMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              {aiErrorMsg}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}