'use client';

import { useEffect, useState } from 'react';
import { Coins, Save } from 'lucide-react';
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ displayCurrency: 'CNY', usdCnyRate: 7 });
  const [rateInput, setRateInput] = useState('7');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    adminApi
      .getSettings()
      .then((res) => {
        const data = unwrap<{ settings: Settings }>(res).data.settings;
        setSettings(data);
        setRateInput(String(data.usdCnyRate));
      })
      .catch((e) => setErrorMsg(getErrorMessage(e, '读取设置失败')));
  }, []);

  const save = async () => {
    setBusy(true);
    setErrorMsg('');
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setErrorMsg('汇率必须是大于 0 的数字');
      setBusy(false);
      return;
    }
    try {
      const res = await adminApi.updateSettings({ displayCurrency: settings.displayCurrency, usdCnyRate: rate });
      const body = unwrap<unknown>(res);
      if (body.code !== 0) {
        setErrorMsg(body.message || '保存失败');
      } else {
        setSettings({ displayCurrency: settings.displayCurrency, usdCnyRate: rate });
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
    </div>
  );
}