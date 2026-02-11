'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { jobs } from '@/lib/mock-data';
import { Briefcase, MapPin, Clock, DollarSign, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const typeColors: Record<string, string> = {
  'full-time': 'bg-green-100 text-green-700',
  'part-time': 'bg-blue-100 text-blue-700',
  internship: 'bg-yellow-100 text-yellow-700',
  remote: 'bg-teal-100 text-teal-700',
};

export default function StudentJobs() {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.type === filter);

  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      <DashboardHeader greeting="Job Opportunities" subtitle="Find your next career opportunity" />

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'full-time', 'part-time', 'internship', 'remote'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === type
                ? 'bg-[#1A1A1A] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {type === 'all' ? 'All Jobs' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredJobs.map((job) => {
          const isExpanded = expandedJob === job.id;
          return (
            <div key={job.id} className="bg-white rounded-2xl card-shadow overflow-hidden hover:card-shadow-hover transition-all duration-200">
              <button
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                className="w-full flex items-start justify-between p-6 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Briefcase size={20} className="text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">{job.title}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <DollarSign size={12} />
                        {job.salary}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[job.type] || 'bg-gray-100 text-gray-600'}`}>
                        {job.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{job.deadline}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 pt-0">
                  <div className="ml-16 border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-700 mb-4">{job.description}</p>
                    <div className="mb-4">
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
                    <div className="flex items-center gap-3">
                      <button className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors flex items-center gap-2">
                        <ExternalLink size={14} />
                        Apply Now
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock size={12} />
                        Posted {job.postedDate}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredJobs.length === 0 && (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No jobs found</h3>
          <p className="text-sm text-gray-500">Try a different filter to see more opportunities.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
