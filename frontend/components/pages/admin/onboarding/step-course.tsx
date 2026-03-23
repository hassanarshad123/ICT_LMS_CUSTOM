'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, BookOpen } from 'lucide-react';
import { createCourse } from '@/lib/api/courses';
import { useMutation } from '@/hooks/use-api';

interface StepCourseProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function StepCourse({ onNext, onSkip }: StepCourseProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { execute: doCreate, loading } = useMutation(
    (data: { title: string; description?: string }) => createCourse(data),
  );

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Course title is required');
      return;
    }
    try {
      await doCreate({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Course created');
      onNext();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create course');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <BookOpen size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Create Your First Course</h2>
          <p className="text-sm text-gray-500">
            Add a course that you can later assign to batches
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Course Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Web Development Fundamentals"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the course..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
        />
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
          Create & Finish
        </button>
      </div>
    </div>
  );
}
