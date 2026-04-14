'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/lib/utils/format';

interface DatePopoverProps {
  value?: string | null; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

/**
 * Button-as-input that opens an inline calendar. Drop-in replacement for
 * ``<input type="date">``. Emits ISO yyyy-mm-dd strings to stay compatible
 * with the rest of the admissions data flow.
 */
export function DatePopover({
  value,
  onChange,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  disabled,
  className,
}: DatePopoverProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? parseIsoLocal(value) : undefined;

  const disabledDays: Array<(d: Date) => boolean> = [];
  if (minDate) disabledDays.push((d) => d < startOfDay(minDate));
  if (maxDate) disabledDays.push((d) => d > startOfDay(maxDate));

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={[
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-left',
            'border-gray-200 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:border-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            className || '',
          ].join(' ')}
        >
          <span className={value ? 'text-primary font-medium' : 'text-gray-400'}>
            {value ? formatDate(value) : placeholder}
          </span>
          <CalendarIcon size={16} className="text-gray-400 flex-shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toIsoLocal(date));
            setOpen(false);
          }}
          disabled={disabledDays.length ? disabledDays : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function parseIsoLocal(iso: string): Date {
  // Parse YYYY-MM-DD as a LOCAL date (avoid UTC off-by-one in timezones east of UTC)
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
