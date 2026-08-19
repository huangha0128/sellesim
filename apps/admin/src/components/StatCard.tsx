import { Card } from '@/components/ui/card';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string; // 莫兰迪主色 hex
  delay?: number;
}

export function StatCard({ label, value, icon, color, delay = 0 }: StatCardProps) {
  return (
    <Card
      className="group overflow-hidden border-transparent bg-white/70 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: color }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[26px] font-bold leading-none tracking-tight text-ink">
            {value}
          </div>
          <div className="mt-1.5 text-[13px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}