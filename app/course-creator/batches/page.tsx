'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { batches as initialBatches, teachers, students as initialStudents } from '@/lib/mock-data';
import { Batch, Student } from '@/lib/types';
import { Plus, X, Users, ChevronDown, ChevronUp, Trash2, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { statusColors } from '@/lib/constants';

export default function CourseCreatorBatches() {
  const [batchList, setBatchList] = useState<Batch[]>(initialBatches);
  const [studentList, setStudentList] = useState<Student[]>(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<Record<string, { name: string; email: string; phone: string }>>({});

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

  const deleteBatch = (id: string) => {
    setBatchList(batchList.filter((b) => b.id !== id));
  };

  const addStudent = (batchId: string) => {
    const form = studentForm[batchId];
    if (!form?.name.trim() || !form?.email.trim()) return;
    const batch = batchList.find((b) => b.id === batchId);
    const newStudent: Student = {
      id: `s${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      batchIds: [batchId],
      batchNames: [batch?.name ?? ''],
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    setStudentList([...studentList, newStudent]);
    setStudentForm({ ...studentForm, [batchId]: { name: '', email: '', phone: '' } });
  };

  const removeStudent = (id: string) => {
    setStudentList(studentList.filter((s) => s.id !== id));
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Batches" subtitle="Create and manage student batches" />

      <div className="mb-6">
        {showForm ? (
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Teacher</label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.specialization}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  Create Batch
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormData({ name: '', startDate: '', endDate: '', teacherId: '' }); }}
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
          >
            <Plus size={16} />
            Create Batch
          </button>
        )}
      </div>

      {batchList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No batches yet</h3>
          <p className="text-sm text-gray-500">Create your first batch to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batchList.map((batch) => {
            const isExpanded = expandedBatch === batch.id;
            const batchStudents = studentList.filter((s) => s.batchIds.includes(batch.id));
            const form = studentForm[batch.id] || { name: '', email: '', phone: '' };
            return (
              <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <button
                    onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                    className="flex items-center gap-4 flex-1 text-left"
                  >
                    <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                      <Users size={18} className="text-[#1A1A1A]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#1A1A1A]">{batch.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}>
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </span>
                        <span className="text-xs text-gray-400">{batch.teacherName}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users size={12} />
                          {batchStudents.length} students
                        </span>
                        <span className="text-xs text-gray-400">
                          {batch.startDate} — {batch.endDate}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  <Link
                    href={`/course-creator/batches/${batch.id}`}
                    className="ml-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] text-white text-xs font-medium rounded-lg hover:bg-[#333] transition-colors"
                  >
                    <FolderOpen size={14} />
                    Manage Content
                  </Link>
                  <button
                    onClick={() => deleteBatch(batch.id)}
                    className="ml-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete batch"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    {batchStudents.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {batchStudents.map((student) => (
                          <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-xs font-bold text-white">
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#1A1A1A]">{student.name}</p>
                                <p className="text-xs text-gray-400">{student.email} &middot; {student.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {student.status}
                              </span>
                              <button
                                onClick={() => removeStudent(student.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mb-4">No students in this batch yet.</p>
                    )}

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h5 className="text-sm font-medium text-[#1A1A1A] mb-3">Add Student</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, name: e.target.value } })}
                          placeholder="Name"
                          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                        />
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, email: e.target.value } })}
                          placeholder="Email"
                          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={form.phone}
                            onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, phone: e.target.value } })}
                            placeholder="Phone"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                          />
                          <button
                            onClick={() => addStudent(batch.id)}
                            className="px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
