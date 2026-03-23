'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBasePath } from '@/hooks/use-base-path';
import { useAuth } from '@/lib/auth-context';
import { globalSearch, SearchResults } from '@/lib/api/search';
import {
  Search,
  X,
  User,
  Layers,
  BookOpen,
  Megaphone,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const CATEGORY_CONFIG = {
  users: { label: 'Users', icon: User, basePath: '/users' },
  batches: { label: 'Batches', icon: Layers, basePath: '/batches' },
  courses: { label: 'Courses', icon: BookOpen, basePath: '/courses' },
  announcements: { label: 'Announcements', icon: Megaphone, basePath: '/announcements' },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

export default function SearchModal() {
  const router = useRouter();
  const basePath = useBasePath();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build flat list of results for keyboard navigation
  const flatResults = results
    ? ([
        ...results.users.map((r) => ({ ...r, category: 'users' as Category })),
        ...results.batches.map((r) => ({ ...r, category: 'batches' as Category })),
        ...results.courses.map((r) => ({ ...r, category: 'courses' as Category })),
        ...results.announcements.map((r) => ({ ...r, category: 'announcements' as Category })),
      ])
    : [];

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (term: string) => {
    if (term.length < 1) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(term);
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value.trim()), 300);
  };

  const navigateToResult = (item: typeof flatResults[number]) => {
    const config = CATEGORY_CONFIG[item.category];
    let path = `${basePath}${config.basePath}`;

    if (item.category === 'users') {
      path = `${basePath}/users/${item.id}`;
    } else if (item.category === 'batches') {
      path = `${basePath}/batches/${item.id}`;
    } else if (item.category === 'courses') {
      path = `${basePath}/courses/${item.id}`;
    }
    // announcements goes to the list page (no individual detail page)

    router.push(path);
    setOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      navigateToResult(flatResults[selectedIndex]);
    }
  };

  const getResultLabel = (item: typeof flatResults[number]) => {
    if ('name' in item) return item.name;
    if ('title' in item) return item.title;
    return '';
  };

  const getResultSubtitle = (item: typeof flatResults[number]) => {
    if (item.category === 'users' && 'email' in item) return item.email;
    if (item.category === 'announcements' && 'scope' in item) return item.scope;
    return null;
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        aria-label="Search"
        title="Search (Ctrl+K)"
      >
        <Search size={18} className="text-gray-500" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[8vh] sm:pt-[15vh] px-4">
        <div className="w-full max-w-lg bg-white rounded-2xl card-shadow overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search users, batches, courses, announcements..."
              className="flex-1 text-sm text-primary placeholder:text-gray-400 outline-none bg-transparent"
            />
            {loading && <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] sm:max-h-80 overflow-y-auto">
            {query.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Type to search across your LMS</p>
                <p className="text-xs text-gray-300 mt-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+K</kbd> to open anytime
                </p>
              </div>
            ) : results && flatResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No results for &quot;{query}&quot;</p>
              </div>
            ) : results ? (
              <div className="py-1">
                {(Object.keys(CATEGORY_CONFIG) as Category[]).map((category) => {
                  const items = results[category];
                  if (!items || items.length === 0) return null;
                  const config = CATEGORY_CONFIG[category];
                  const Icon = config.icon;

                  return (
                    <div key={category}>
                      <div className="px-4 py-1.5">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{config.label}</p>
                      </div>
                      {items.map((item) => {
                        const globalIdx = flatResults.findIndex(
                          (f) => f.id === item.id && f.category === category,
                        );
                        const isSelected = globalIdx === selectedIndex;
                        const itemWithCategory = { ...item, category };

                        return (
                          <button
                            key={item.id}
                            onClick={() => navigateToResult(itemWithCategory)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isSelected ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Icon size={16} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{getResultLabel(itemWithCategory)}</p>
                              {getResultSubtitle(itemWithCategory) && (
                                <p className="text-xs text-gray-400 truncate">{getResultSubtitle(itemWithCategory)}</p>
                              )}
                            </div>
                            {isSelected && <ArrowRight size={14} className="text-primary flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
