'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, Users, FileText, CreditCard, BookOpen, Activity, Clock, X } from 'lucide-react';
import { saGlobalSearch, type SearchResultItem, type SASearchResponse } from '@/lib/api/super-admin';

const CATEGORY_META: Record<string, { label: string; icon: typeof Building2 }> = {
  institutes: { label: 'Institutes', icon: Building2 },
  users: { label: 'Users', icon: Users },
  invoices: { label: 'Invoices', icon: FileText },
  payments: { label: 'Payments', icon: CreditCard },
  courses: { label: 'Courses', icon: BookOpen },
  activity: { label: 'Activity', icon: Activity },
};

const CATEGORIES = ['institutes', 'users', 'invoices', 'payments', 'courses', 'activity'] as const;

function flattenResults(data: SASearchResponse | null): { category: string; item: SearchResultItem }[] {
  if (!data) return [];
  const flat: { category: string; item: SearchResultItem }[] = [];
  for (const cat of CATEGORIES) {
    for (const item of data[cat] || []) {
      flat.push({ category: cat, item });
    }
  }
  return flat;
}

export function SASearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SASearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sa_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setDebouncedQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length < 2) {
      setDebouncedQuery('');
      setResults(null);
      return;
    }
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) return;
    setLoading(true);
    saGlobalSearch(debouncedQuery, 3)
      .then((r) => { setResults(r); setSelectedIndex(0); })
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const flat = flattenResults(results);

  const saveRecentSearch = useCallback((q: string) => {
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    try { localStorage.setItem('sa_recent_searches', JSON.stringify(updated)); } catch {}
  }, [recentSearches]);

  const navigate = useCallback((url: string) => {
    if (query) saveRecentSearch(query);
    setOpen(false);
    router.push(url);
  }, [query, saveRecentSearch, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[selectedIndex]) {
      navigate(flat[selectedIndex].item.url);
    }
  };

  if (!open) return null;

  let currentCategory = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <Search size={18} className="text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search institutes, users, invoices..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-zinc-100 rounded">
              <X size={14} className="text-zinc-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-100 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-900" />
            </div>
          )}

          {!loading && debouncedQuery && flat.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-400">
              No results for &quot;{debouncedQuery}&quot;
            </div>
          )}

          {!loading && flat.length > 0 && (
            <div className="py-2">
              {flat.map((entry, i) => {
                const meta = CATEGORY_META[entry.category];
                const Icon = meta?.icon || Activity;
                const showHeader = entry.category !== currentCategory;
                if (showHeader) currentCategory = entry.category;

                return (
                  <div key={`${entry.category}-${entry.item.id}`}>
                    {showHeader && (
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {meta?.label || entry.category}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(entry.item.url)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === selectedIndex ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <Icon size={16} className="text-zinc-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">{entry.item.label}</div>
                        {entry.item.sublabel && (
                          <div className="text-xs text-zinc-500 truncate">{entry.item.sublabel}</div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !debouncedQuery && recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Recent Searches
              </div>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-zinc-50 transition-colors"
                >
                  <Clock size={14} className="text-zinc-400" />
                  <span className="text-sm text-zinc-700">{s}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && !debouncedQuery && recentSearches.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-400">
              Type to search across all entities
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-100 bg-zinc-50 text-[10px] text-zinc-400">
          <span>
            <kbd className="px-1 py-0.5 bg-zinc-200 rounded text-zinc-500 mr-1">↑↓</kbd> navigate
            <kbd className="px-1 py-0.5 bg-zinc-200 rounded text-zinc-500 mx-1">↵</kbd> open
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-zinc-200 rounded text-zinc-500 mr-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
