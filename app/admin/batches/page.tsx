'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { batches as initialBatches, teachers } from '@/lib/mock-data';
import { Plus, X } from 'lucide-react';

export default function AdminBatches() {
  const [batchList, setBatchList] = useState(initialBatches);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const teacher = teachers.find((t) => t.id === formData.teacherId);
    setBatchList([
      ...batchList,
      {
        id: `b${Date.now()}`,
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        studentCount: 0,
        teacherId: formData.teacherId,
        teacherName: teacher?.name || '',
        status: 'upcoming',
      },
    ]);
    setFormData({ name: '', startDate: '', endDate: '', teacherId: '' });
    setShowForm(false);
  };

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Batches" subtitle="Manage all course batches" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Batch'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Batch</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Batch 5 - March 2025"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Teacher</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Create Batch
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Batch Name</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Students</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Duration</th>
                <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {batchList.map((batch) => (
                <tr key={batch.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-[#1A1A1A]">{batch.name}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{batch.teacherName}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{batch.studentCount}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{batch.startDate} to {batch.endDate}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      batch.status === 'active' ? 'bg-green-100 text-green-700' :
                      batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
