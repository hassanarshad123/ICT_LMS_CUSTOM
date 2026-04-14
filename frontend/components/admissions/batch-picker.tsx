'use client';

import { useMemo, useState } from 'react';
import { Clock, Layers, Search } from 'lucide-react';
import type { BatchOut } from '@/lib/api/batches';
import { formatDate } from '@/lib/utils/format';

interface BatchPickerProps {
  batches: BatchOut[];
  selectedId: string;
  onSelect: (batchId: string) => void;
  /** Batch ids the officer has recently onboarded students into, newest first. */
  recentBatchIds?: string[];
  loading?: boolean;
}

export default function BatchPicker({
  batches,
  selectedId,
  onSelect,
  recentBatchIds = [],
  loading,
}: BatchPickerProps) {
  const [query, setQuery] = useState('');

  const { recent, all } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (b: BatchOut) => !q || b.name.toLowerCase().includes(q);

    const recentSet = new Set(recentBatchIds);
    const byId = new Map(batches.map((b) => [b.id, b]));

    // Recent: keep provided order, filter to existing + search-matching
    const recent = recentBatchIds
      .map((id) => byId.get(id))
      .filter((b): b is BatchOut => !!b && matches(b));

    // All: everything that isn't in recent, matching the search
    const all = batches.filter((b) => !recentSet.has(b.id) && matches(b));

    return { recent, all };
  }, [batches, recentBatchIds, query]);

  const totalMatches = recent.length + all.length;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search batches by name…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-primary"
          autoFocus
        />
      </div>

      {loading && (
        <p className="text-sm text-gray-500 py-4 text-center">Loading batches…</p>
      )}

      {!loading && batches.length === 0 && (
        <EmptyMessage
          title="No batches available"
          body="Ask an admin to create a batch before onboarding students."
        />
      )}

      {!loading && batches.length > 0 && totalMatches === 0 && (
        <EmptyMessage
          title="No matches"
          body={`No batches match "${query}". Try a different search.`}
        />
      )}

      {!loading && recent.length > 0 && (
        <Section label="Recently used" icon={<Clock size={12} />}>
          {recent.map((b) => (
            <BatchCard key={b.id} batch={b} selected={b.id === selectedId} onSelect={onSelect} />
          ))}
        </Section>
      )}

      {!loading && all.length > 0 && (
        <Section
          label={recent.length > 0 ? 'All batches' : 'Batches'}
          icon={<Layers size={12} />}
        >
          {all.map((b) => (
            <BatchCard key={b.id} batch={b} selected={b.id === selectedId} onSelect={onSelect} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function BatchCard({
  batch,
  selected,
  onSelect,
}: {
  batch: BatchOut;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(batch.id)}
      className={[
        'text-left p-4 rounded-xl border transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-gray-200 hover:border-gray-300 bg-white',
      ].join(' ')}
    >
      <p className="font-semibold text-primary">{batch.name}</p>
      <p className="text-xs text-gray-500 mt-1">
        {formatDate(batch.startDate)} → {formatDate(batch.endDate)}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {batch.studentCount || 0} students enrolled
      </p>
    </button>
  );
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 rounded-xl bg-gray-50 text-center">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{body}</p>
    </div>
  );
}
