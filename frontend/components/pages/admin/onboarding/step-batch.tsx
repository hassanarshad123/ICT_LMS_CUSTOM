'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Layers } from 'lucide-react';
import { createBatch } from '@/lib/api/batches';
import { useMutation } from '@/hooks/use-api';

interface StepBatchProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function StepBatch({ onNext, onSkip }: StepBatchProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { execute: doCreate, loading } = useMutation(
    (data: { name: string; start_date: string; end_date: string }) => createBatch(data),
  );

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Batch name is required');
      return;
    }
    if (!startDate) {
      toast.error('Start date is required');
      return;
    }
    if (!endDate) {
      toast.error('End date is required');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }
    try {
      await doCreate({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
      });
      toast.success('Batch created');
      onNext();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create batch');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Layers size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Create Your First Batch</h2>
          <p className="text-sm text-gray-500">
            A batch groups students together for a time period
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Batch Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. January 2026 Cohort"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Skip this step
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Create & Continue
        </button>
      </div>
    </div>
  );
}
