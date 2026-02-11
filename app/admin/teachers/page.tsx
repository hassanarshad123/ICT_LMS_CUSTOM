'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { teachers as initialTeachers, batches } from '@/lib/mock-data';
import { Plus, X } from 'lucide-react';

export default function AdminTeachers() {
  const [teacherList, setTeacherList] = useState(initialTeachers);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', specialization: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherList([
      ...teacherList,
      {
        id: `t${Date.now()}`,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        specialization: formData.specialization,
        batchIds: [],
        status: 'active',
      },
    ]);
    setFormData({ name: '', email: '', phone: '', specialization: '' });
    setShowForm(false);
  };

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Teachers" subtitle="Manage all teachers" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Teacher'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Teacher</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Teacher full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="teacher@ict.edu.pk" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
              <input type="text" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Add Teacher
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teacherList.map((teacher) => {
          const assignedBatches = batches.filter((b) => teacher.batchIds.includes(b.id));
          return (
            <div key={teacher.id} className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#C5D86D] flex items-center justify-center text-lg font-semibold text-[#1A1A1A]">
                  {teacher.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A]">{teacher.name}</h4>
                  <p className="text-xs text-gray-500">{teacher.specialization}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>{teacher.email}</p>
                <p>{teacher.phone}</p>
              </div>
              {assignedBatches.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned Batches</p>
                  <div className="flex flex-wrap gap-2">
                    {assignedBatches.map((b) => (
                      <span key={b.id} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                        {b.name.split(' - ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  teacher.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {teacher.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
