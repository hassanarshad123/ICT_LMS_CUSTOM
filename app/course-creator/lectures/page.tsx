'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { lectures as initialLectures, batches } from '@/lib/mock-data';
import { Plus, X, Video, Clock, GripVertical } from 'lucide-react';

export default function CourseCreatorLectures() {
  const [lectureList, setLectureList] = useState(initialLectures);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', videoUrl: '', duration: '', batchId: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === formData.batchId);
    setLectureList([
      ...lectureList,
      {
        id: `l${Date.now()}`,
        title: formData.title,
        description: formData.description,
        videoUrl: formData.videoUrl,
        duration: formData.duration,
        batchId: formData.batchId,
        batchName: batch?.name.split(' - ')[0] || '',
        uploadDate: new Date().toISOString().split('T')[0],
        order: lectureList.length + 1,
        courseId: '',
      },
    ]);
    setFormData({ title: '', description: '', videoUrl: '', duration: '', batchId: '' });
    setShowForm(false);
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Lectures" subtitle="Manage recorded lectures for students" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Lecture'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Lecture</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lecture Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Introduction to Excel" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of the lecture" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 h-24 resize-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Video URL</label>
              <input type="url" value={formData.videoUrl} onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })} placeholder="https://youtube.com/..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
              <input type="text" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 45 min" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
              <select value={formData.batchId} onChange={(e) => setFormData({ ...formData, batchId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required>
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Upload Lecture
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {lectureList.map((lecture, index) => (
          <div key={lecture.id} className="bg-white rounded-2xl p-5 card-shadow hover:card-shadow-hover transition-all duration-200 flex items-center gap-4">
            <div className="text-gray-300">
              <GripVertical size={20} />
            </div>
            <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Video size={18} className="text-[#1A1A1A]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                <h4 className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</h4>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{lecture.description}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock size={14} />
                {lecture.duration}
              </div>
              <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                {lecture.batchName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
