'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  className?: string;
}

export function NumberField({ value, onChange, min, max, step = 1, precision, className }: NumberFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min ?? 0);
      return;
    }
    let next = Number(raw);
    if (Number.isNaN(next)) return;
    if (precision !== undefined) next = Number(next.toFixed(precision));
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(next);
  };

  const stepDown = () => {
    let next = Number((value - step).toFixed(precision ?? 0));
    if (min !== undefined && next < min) next = min;
    onChange(next);
  };

  const stepUp = () => {
    let next = Number((value + step).toFixed(precision ?? 0));
    if (max !== undefined && next > max) next = max;
    onChange(next);
  };

  return (
    <div className={cn('flex items-center', className)}>
      <button
        type="button"
        onClick={stepDown}
        className="h-9 rounded-l-md border border-r-0 border-input px-2 text-muted-foreground hover:bg-accent"
      >
        −
      </button>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        className="h-9 w-20 rounded-none text-center"
        aria-label="数字输入"
      />
      <button
        type="button"
        onClick={stepUp}
        className="h-9 rounded-r-md border border-l-0 border-input px-2 text-muted-foreground hover:bg-accent"
      >
        +
      </button>
    </div>
  );
}