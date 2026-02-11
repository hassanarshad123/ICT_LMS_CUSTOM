'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { batches, students } from '@/lib/mock-data';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';

const teacherBatches = batches.filter((b) => b.teacherId === 't1');

export default function TeacherBatches() {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(teacherBatches[0]?.id || null);

  return (
    <DashboardLayout role="teacher" userName="Ahmed Khan">
      <DashboardHeader greeting="My Batches" subtitle="View your assigned batches and their students" />

      <div className="space-y-4">
        {teacherBatches.map((batch) => {
          const batchStudents = students.filter((s) => s.batchId === batch.id);
          const isExpanded = expandedBatch === batch.id;

          return (
            <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
              <button
                onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#C5D86D] rounded-xl flex items-center justify-center">
                    <Users size={22} className="text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1A1A1A]">{batch.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{batch.startDate} to {batch.endDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#1A1A1A]">{batchStudents.length}</p>
                    <p className="text-xs text-gray-500">students</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    batch.status === 'active' ? 'bg-green-100 text-green-700' :
                    batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {batch.status}
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && batchStudents.length > 0 && (
                <div className="px-4 sm:px-6 pb-6">
                  <div className="ml-0 sm:ml-16 space-y-2">
                    {batchStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#C5D86D] flex items-center justify-center text-xs font-semibold text-[#1A1A1A]">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1A1A1A]">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{student.phone}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {student.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && batchStudents.length === 0 && (
                <div className="px-4 sm:px-6 pb-6">
                  <p className="ml-0 sm:ml-16 text-sm text-gray-500">No students enrolled yet.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
