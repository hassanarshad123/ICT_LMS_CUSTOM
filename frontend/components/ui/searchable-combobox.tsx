'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  /**
   * When set, the parent owns filtering (usually a debounced server fetch).
   * The built-in cmdk client-side filter is disabled and every keystroke is
   * forwarded via this callback so the parent can refetch.
   */
  onSearchChange?: (query: string) => void;
  /** Show a loading hint inside the listbox (only meaningful with onSearchChange). */
  loading?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className,
  disabled = false,
  onSearchChange,
  loading = false,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const serverMode = typeof onSearchChange === 'function';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-left transition-colors hover:border-gray-300 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed',
            !value && 'text-gray-400',
            className
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={!serverMode}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={serverMode ? search : undefined}
            onValueChange={(v) => {
              if (serverMode) {
                setSearch(v);
                onSearchChange!(v);
              }
            }}
          />
          <CommandList className="max-h-60">
            <CommandEmpty>
              {loading ? 'Searching...' : emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {/* Empty option to clear selection */}
              <CommandItem
                value="__clear__"
                onSelect={() => { onChange(''); setOpen(false); }}
                className="text-gray-400 italic"
              >
                {placeholder}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => { onChange(option.value); setOpen(false); }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
