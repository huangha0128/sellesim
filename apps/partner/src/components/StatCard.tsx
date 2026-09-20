import { Card } from '@/components/ui/card';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string; // 品牌点缀色 hex
  delay?: number;
}

export function StatCard({ label, value, icon, color, delay = 0 }: StatCardProps) {
  return (
    <Card
      className="panel-card group overflow-hidden transition-transform animate-fade-up hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[24px] font-bold leading-none tracking-tight text-ink tabular-nums">
            {value}
          </div>
          <div className="mt-2 text-[12px] font-medium text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}