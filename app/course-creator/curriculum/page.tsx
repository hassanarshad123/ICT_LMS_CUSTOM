'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { curriculum as initialCurriculum } from '@/lib/mock-data';
import { Plus, X, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

export default function CourseCreatorCurriculum() {
  const [modules, setModules] = useState(initialCurriculum);
  const [expandedModule, setExpandedModule] = useState<string | null>(modules[0]?.id || null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', topics: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setModules([
      ...modules,
      {
        id: `c${Date.now()}`,
        title: formData.title,
        description: formData.description,
        order: modules.length + 1,
        topics: formData.topics.split('\n').filter((t) => t.trim()),
      },
    ]);
    setFormData({ title: '', description: '', topics: '' });
    setShowForm(false);
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Curriculum" subtitle="Define the course structure and modules" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Module'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Module</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Module Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Module 7: Advanced Topics" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of the module" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 h-20 resize-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Topics (one per line)</label>
              <textarea value={formData.topics} onChange={(e) => setFormData({ ...formData, topics: e.target.value })} placeholder="Topic 1&#10;Topic 2&#10;Topic 3" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 h-32 resize-none" required />
            </div>
            <button type="submit" className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
              Add Module
            </button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {modules.map((module) => (
          <div key={module.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
            <button
              onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-[#1A1A1A]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A]">{module.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{module.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{module.topics.length} topics</span>
                {expandedModule === module.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            </button>
            {expandedModule === module.id && (
              <div className="px-6 pb-6 pt-0">
                <div className="ml-14 space-y-2">
                  {module.topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <span className="w-6 h-6 rounded-full bg-[#E8E8E8] flex items-center justify-center text-xs font-semibold text-gray-600">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
