'use client';

import { Input } from '@/components/ui/input';

export type DurationValue =
  | { kind: 'until-batch-end' }
  | { kind: 'days'; value: number }
  | { kind: 'end-date'; value: string };

export interface CustomDurationPickerProps {
  value: DurationValue;
  onChange: (v: DurationValue) => void;
  disableUntilBatchEnd?: boolean;
}

export function CustomDurationPicker({ value, onChange, disableUntilBatchEnd }: CustomDurationPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {!disableUntilBatchEnd && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.kind === 'until-batch-end'}
              onChange={() => onChange({ kind: 'until-batch-end' })}
            />
            <span className="text-sm text-gray-700">Until batch end (default)</span>
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value.kind === 'days'}
            onChange={() => onChange({ kind: 'days', value: 30 })}
          />
          <span className="text-sm text-gray-700">N days from today</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value.kind === 'end-date'}
            onChange={() => onChange({ kind: 'end-date', value: '' })}
          />
          <span className="text-sm text-gray-700">Specific end date</span>
        </label>
      </div>

      {value.kind === 'days' && (
        <Input
          type="number"
          min={1}
          max={3650}
          value={value.value}
          onChange={(e) => onChange({ kind: 'days', value: Number(e.target.value) })}
          className="w-full"
        />
      )}
      {value.kind === 'end-date' && (
        <Input
          type="date"
          value={value.value}
          onChange={(e) => onChange({ kind: 'end-date', value: e.target.value })}
          className="w-full"
        />
      )}
    </div>
  );
}

export function toAccessDuration(v: DurationValue): { accessDays?: number; accessEndDate?: string } {
  if (v.kind === 'days') return { accessDays: v.value };
  if (v.kind === 'end-date' && v.value) return { accessEndDate: v.value };
  return {};
}
