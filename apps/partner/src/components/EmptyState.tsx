export function EmptyState({ title = '暂无数据', hint = '这里还没有内容' }: { title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
        </svg>
      </div>
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="text-[12px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}