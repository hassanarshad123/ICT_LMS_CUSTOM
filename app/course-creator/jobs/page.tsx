'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { jobs as initialJobs } from '@/lib/mock-data';
import { Job } from '@/lib/types';
import { Plus, Briefcase, MapPin, DollarSign, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const typeColors: Record<string, string> = {
  'full-time': 'bg-green-100 text-green-700',
  'part-time': 'bg-blue-100 text-blue-700',
  internship: 'bg-yellow-100 text-yellow-700',
  remote: 'bg-teal-100 text-teal-700',
};

export default function CourseCreatorJobs() {
  const [jobList, setJobList] = useState<Job[]>(initialJobs);
  const [showForm, setShowForm] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    type: 'full-time' as Job['type'],
    salary: '',
    description: '',
    requirements: '',
    deadline: '',
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newJob: Job = {
      id: `j${Date.now()}`,
      title: formData.title,
      company: formData.company,
      location: formData.location,
      type: formData.type,
      salary: formData.salary,
      description: formData.description,
      requirements: formData.requirements.split(',').map((r) => r.trim()).filter(Boolean),
      postedDate: new Date().toISOString().split('T')[0],
      deadline: formData.deadline,
    };
    setJobList([newJob, ...jobList]);
    setFormData({ title: '', company: '', location: '', type: 'full-time', salary: '', description: '', requirements: '', deadline: '' });
    setShowForm(false);
  };

  const deleteJob = (id: string) => {
    setJobList(jobList.filter((j) => j.id !== id));
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Jobs" subtitle="Post job opportunities for students" />

      <div className="mb-6">
        {showForm ? (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Job Posting</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Data Entry Operator"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. TechVentures Lahore"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Lahore"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Job['type'] })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="internship">Internship</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Salary</label>
                <input
                  type="text"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  placeholder="e.g. PKR 35,000 - 45,000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the job role and responsibilities"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50 resize-none"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements (comma separated)</label>
                <input
                  type="text"
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="e.g. Basic computer skills, MS Office proficiency, Attention to detail"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-gray-50"
                  required
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  Post Job
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormData({ title: '', company: '', location: '', type: 'full-time', salary: '', description: '', requirements: '', deadline: '' }); }}
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
            Post New Job
          </button>
        )}
      </div>

      {jobList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No jobs posted yet</h3>
          <p className="text-sm text-gray-500">Post your first job opportunity for students.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobList.map((job) => {
            const isExpanded = expandedJob === job.id;
            return (
              <div key={job.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-start justify-between p-5">
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className="flex items-start gap-4 flex-1 text-left"
                  >
                    <div className="w-11 h-11 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Briefcase size={18} className="text-[#1A1A1A]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#1A1A1A]">{job.title}</h4>
                      <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[job.type]}`}>
                          {job.type}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={12} />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <DollarSign size={12} />
                          {job.salary}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          Deadline: {job.deadline}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-1" /> : <ChevronDown size={16} className="text-gray-400 mt-1" />}
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete job"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 sm:px-5 py-4 ml-0 sm:ml-16">
                    <p className="text-sm text-gray-700 mb-4">{job.description}</p>
                    {job.requirements.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Requirements</h5>
                        <ul className="space-y-1.5">
                          {job.requirements.map((req, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#C5D86D]" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-4">Posted {job.postedDate}</p>
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
