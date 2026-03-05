'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { courseCreators as initialCreators } from '@/lib/mock-data';
import { CourseCreator } from '@/lib/types';
import { Plus, X, Trash2, PenTool } from 'lucide-react';

export default function AdminCourseCreators() {
  const [creatorList, setCreatorList] = useState<CourseCreator[]>(initialCreators);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatorList([
      ...creatorList,
      {
        id: `cc${Date.now()}`,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: 'active',
      },
    ]);
    setFormData({ name: '', email: '', phone: '' });
    setShowForm(false);
  };

  const toggleStatus = (id: string) => {
    setCreatorList(
      creatorList.map((c) =>
        c.id === id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c
      )
    );
  };

  const deleteCreator = (id: string) => {
    setCreatorList(creatorList.filter((c) => c.id !== id));
  };

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Course Creators" subtitle="Manage course creator accounts" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Course Creator'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Course Creator</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="creator@ict.edu.pk"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0300-1234567"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
                Add Course Creator
              </button>
            </div>
          </form>
        </div>
      )}

      {creatorList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PenTool size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No course creators yet</h3>
          <p className="text-sm text-gray-500">Add your first course creator to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatorList.map((creator) => (
            <div key={creator.id} className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#C5D86D] flex items-center justify-center text-lg font-semibold text-[#1A1A1A]">
                    {creator.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">{creator.name}</h4>
                    <p className="text-xs text-gray-500">Course Creator</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteCreator(creator.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete course creator"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>{creator.email}</p>
                <p>{creator.phone}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  creator.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {creator.status.charAt(0).toUpperCase() + creator.status.slice(1)}
                </span>
                <button
                  onClick={() => toggleStatus(creator.id)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    creator.status === 'active'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {creator.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
