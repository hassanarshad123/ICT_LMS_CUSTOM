'use client';

import { CheckCircle2, Search, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface MonitoringFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  source: string;
  onSourceChange: (value: string) => void;
  level: string;
  onLevelChange: (value: string) => void;
  resolvedFilter: string;
  onResolvedFilterChange: (value: string) => void;
  onResolveAll: () => void;
  resolvingAll: boolean;
  onClearResolved: () => void;
  clearing: boolean;
}

export function MonitoringFilters({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  source,
  onSourceChange,
  level,
  onLevelChange,
  resolvedFilter,
  onResolvedFilterChange,
  onResolveAll,
  resolvingAll,
  onClearResolved,
  clearing,
}: MonitoringFiltersProps) {
  return (
    <div className="bg-white rounded-2xl card-shadow p-4">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Search */}
        <form onSubmit={onSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Search error messages..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>
          <select
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
          >
            <option value="">All Levels</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
          <select
            value={resolvedFilter}
            onChange={(e) => onResolvedFilterChange(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={resolvingAll}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                Resolve All
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resolve all errors?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark all unresolved errors as resolved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onResolveAll}>Resolve All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-700 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                Clear Old
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete old resolved errors?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete resolved errors older than 7 days.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearResolved} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
