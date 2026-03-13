'use client';

import { EmptyState } from '@/components/shared/page-states';
import {
  Trash2,
  Users,
  UserPlus,
  Loader2,
} from 'lucide-react';

export interface BatchStudentSectionProps {
  /** Currently selected student ID in the dropdown */
  selectedStudentId: string;
  onSelectedStudentIdChange: (id: string) => void;
  /** Filtered list of students not yet enrolled */
  availableStudents: { id: string; name: string; email: string }[];
  /** Whether the enroll mutation is in flight */
  enrolling: boolean;
  onEnrollStudent: () => void;
  /** Enrolled students for the table */
  students: any[] | null | undefined;
  studentsLoading: boolean;
  /** Called when user clicks the remove button on a student row */
  onRemoveStudentConfirm: (studentId: string) => void;
}

export function BatchStudentSection({
  selectedStudentId,
  onSelectedStudentIdChange,
  availableStudents,
  enrolling,
  onEnrollStudent,
  students,
  studentsLoading,
  onRemoveStudentConfirm,
}: BatchStudentSectionProps) {
  return (
    <>
      {/* Enroll Student */}
      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Enroll Student</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedStudentId}
            onChange={(e) => onSelectedStudentIdChange(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
          >
            <option value="">Select a student...</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
          <button
            onClick={onEnrollStudent}
            disabled={!selectedStudentId || enrolling}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrolling ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Enroll Student
          </button>
        </div>
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-primary">Enrolled Students ({Array.isArray(students) ? students.length : 0})</h3>
        </div>
        {studentsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Loading students...</span>
          </div>
        ) : !Array.isArray(students) || students.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users size={28} className="text-gray-400" />}
              title="No students enrolled"
              description="Use the dropdown above to enroll students in this batch."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Enrolled Date</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{student.name}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.phone || '—'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">
                      {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <button
                        onClick={() => onRemoveStudentConfirm(student.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
