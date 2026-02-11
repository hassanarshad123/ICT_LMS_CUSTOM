'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { students as initialStudents, batches } from '@/lib/mock-data';
import { Plus, X, Search } from 'lucide-react';

export default function AdminStudents() {
  const [studentList, setStudentList] = useState(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', batchId: '' });

  const filteredStudents = studentList.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === formData.batchId);
    setStudentList([
      ...studentList,
      {
        id: `s${Date.now()}`,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        batchId: formData.batchId,
        batchName: batch?.name || '',
        joinDate: new Date().toISOString().split('T')[0],
        status: 'active',
      },
    ]);
    setFormData({ name: '', email: '', phone: '', batchId: '' });
    setShowForm(false);
  };

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Students" subtitle="Manage all enrolled students" />

      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-white w-72"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Student'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Student</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Student full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to Batch</label>
              <select value={formData.batchId} onChange={(e) => setFormData({ ...formData, batchId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required>
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Add Student
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Batch</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#C5D86D] flex items-center justify-center text-xs font-semibold text-[#1A1A1A]">
                        {student.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-[#1A1A1A]">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{student.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{student.batchName}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {student.status}
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
