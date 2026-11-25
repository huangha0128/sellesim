'use client';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
}

export function ListPagination({ page, pageSize, total, onPageChange, onPageSizeChange, disabled }: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
        每页
        <select
          aria-label="每页数量"
          className="h-8 rounded-md border border-input bg-background px-2 text-[12px]"
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        条
      </label>
      <Pagination className="m-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious className="w-auto" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} />
          </PaginationItem>
          <span className="px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
          <PaginationItem>
            <PaginationNext className="w-auto" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
