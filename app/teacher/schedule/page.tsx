'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { zoomClasses as initialClasses, batches } from '@/lib/mock-data';
import { Plus, X, Video, ExternalLink, Clock } from 'lucide-react';

const teacherClasses = initialClasses.filter((z) => z.teacherName === 'Ahmed Khan');
const teacherBatches = batches.filter((b) => b.teacherId === 't1');

export default function TeacherSchedule() {
  const [classes, setClasses] = useState(teacherClasses);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', batchId: '', zoomLink: '', date: '', time: '', duration: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === formData.batchId);
    setClasses([
      ...classes,
      {
        id: `z${Date.now()}`,
        title: formData.title,
        batchId: formData.batchId,
        batchName: batch?.name || '',
        teacherName: 'Ahmed Khan',
        zoomLink: formData.zoomLink,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        status: 'upcoming',
      },
    ]);
    setFormData({ title: '', batchId: '', zoomLink: '', date: '', time: '', duration: '' });
    setShowForm(false);
  };

  const upcoming = classes.filter((c) => c.status === 'upcoming');

  return (
    <DashboardLayout role="teacher" userName="Ahmed Khan">
      <DashboardHeader greeting="Schedule Classes" subtitle="Manage your Zoom classes" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Schedule New Class'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Zoom Class</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Class Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Week 13 - Revision" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
              <select value={formData.batchId} onChange={(e) => setFormData({ ...formData, batchId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required>
                <option value="">Select batch</option>
                {teacherBatches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Link</label>
              <input type="url" value={formData.zoomLink} onChange={(e) => setFormData({ ...formData, zoomLink: e.target.value })} placeholder="https://zoom.us/j/..." className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
              <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
              <input type="text" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 1.5 hours" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div className="flex items-end">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Schedule Class
              </button>
            </div>
          </form>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Upcoming Classes</h3>
          <div className="space-y-3">
            {upcoming.map((cls) => (
              <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#C5D86D] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Video size={22} className="text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#1A1A1A]">{cls.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-14 sm:ml-0">
                  <div className="text-right">
                    <p className="text-sm font-medium text-[#1A1A1A]">{cls.date}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
                      <Clock size={12} />
                      {cls.time} - {cls.duration}
                    </div>
                  </div>
                  <a href={cls.zoomLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center hover:bg-[#333] transition-colors">
                    <ExternalLink size={16} className="text-white" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
