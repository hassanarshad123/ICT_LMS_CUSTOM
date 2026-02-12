'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { getAllUsers, batches, courses, zoomClasses, jobApplications, students } from '@/lib/mock-data';
import { UnifiedUser, UserRole } from '@/lib/types';
import { ArrowLeft, Edit3, Save, BookOpen, Video, Briefcase, Users, Calendar, Shield } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { roleBadgeColors, roleLabels } from '@/lib/constants';

interface UserDetailViewProps {
  role: UserRole;
  userName: string;
  backHref: string;
}

export default function UserDetailView({ role, userName, backHref }: UserDetailViewProps) {
  const params = useParams();
  const userId = params.userId as string;

  const allUsers = getAllUsers();
  const foundUser = allUsers.find((u) => u.id === userId);

  const [editData, setEditData] = useState<UnifiedUser | null>(foundUser || null);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  if (!foundUser || !editData) {
    return (
      <DashboardLayout role={role} userName={userName}>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">User not found</h3>
          <p className="text-sm text-gray-500 mb-4">The user you are looking for does not exist.</p>
          <Link href={backHref} className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Users
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Data for student profile
  const userCourses = editData.role === 'student' && editData.batchId
    ? courses.filter((c) => c.batchIds.includes(editData.batchId!))
    : [];
  const userZoomClasses = editData.role === 'student' && editData.batchId
    ? zoomClasses.filter((z) => z.batchId === editData.batchId)
    : [];
  const upcomingClasses = userZoomClasses.filter((z) => z.status === 'upcoming');
  const pastClasses = userZoomClasses.filter((z) => z.status === 'completed');

  // Data for teacher profile
  const teacherBatches = editData.role === 'teacher' && editData.batchIds
    ? batches.filter((b) => editData.batchIds!.includes(b.id))
    : [];

  const handleSave = () => {
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleStatus = () => {
    setEditData({ ...editData, status: editData.status === 'active' ? 'inactive' : 'active' });
    setShowDeactivateDialog(false);
  };

  return (
    <DashboardLayout role={role} userName={userName}>
      {/* Back Link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Users
      </Link>

      {/* User Header Card */}
      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#C5D86D] flex items-center justify-center text-xl font-bold text-[#1A1A1A]">
              {editData.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">{editData.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[editData.role]}`}>
                  {roleLabels[editData.role]}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  editData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {editData.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
          >
            <Edit3 size={16} />
            {isEditing ? 'Cancel Editing' : 'Edit Profile'}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-700">
          Profile updated successfully.
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information Card */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Profile Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  disabled={!isEditing}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value as UnifiedUser['role'] })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="course-creator">Course Creator</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <div className="flex items-center gap-3 h-[48px]">
                  <button
                    onClick={() => isEditing && setEditData({ ...editData, status: editData.status === 'active' ? 'inactive' : 'active' })}
                    disabled={!isEditing}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                      editData.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-sm text-gray-600 capitalize">{editData.status}</span>
                </div>
              </div>
              {editData.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
                  <select
                    value={editData.batchId || ''}
                    onChange={(e) => {
                      const batch = batches.find((b) => b.id === e.target.value);
                      setEditData({ ...editData, batchId: e.target.value, batchName: batch?.name || '' });
                    }}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                  >
                    <option value="">No batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editData.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                  <input
                    type="text"
                    value={editData.specialization || ''}
                    onChange={(e) => setEditData({ ...editData, specialization: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60"
                  />
                </div>
              )}
            </div>
            {isEditing && (
              <div className="mt-4">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Student: Enrolled Courses */}
          {editData.role === 'student' && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={18} className="text-[#1A1A1A]" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Enrolled Courses</h3>
              </div>
              {userCourses.length === 0 ? (
                <p className="text-sm text-gray-500">No courses enrolled yet.</p>
              ) : (
                <div className="space-y-3">
                  {userCourses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{course.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{course.batchIds.length} batch(es)</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        course.status === 'active' ? 'bg-green-100 text-green-700' : course.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {course.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Student: Zoom Classes */}
          {editData.role === 'student' && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Video size={18} className="text-[#1A1A1A]" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Zoom Classes</h3>
              </div>
              {upcomingClasses.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Upcoming</h4>
                  <div className="space-y-2">
                    {upcomingClasses.map((z) => (
                      <div key={z.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A1A]">{z.title}</p>
                          <p className="text-xs text-gray-500">{z.date} at {z.time} &middot; {z.duration}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Upcoming</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastClasses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Past</h4>
                  <div className="space-y-2">
                    {pastClasses.map((z) => (
                      <div key={z.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{z.title}</p>
                          <p className="text-xs text-gray-400">{z.date} at {z.time}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Completed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {userZoomClasses.length === 0 && (
                <p className="text-sm text-gray-500">No zoom classes scheduled.</p>
              )}
            </div>
          )}

          {/* Student: Job Applications */}
          {editData.role === 'student' && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={18} className="text-[#1A1A1A]" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Job Applications</h3>
              </div>
              {jobApplications.length === 0 ? (
                <p className="text-sm text-gray-500">No applications submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {jobApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{app.jobTitle}</p>
                        <p className="text-xs text-gray-500">{app.company} &middot; Applied {app.appliedDate}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        app.status === 'applied' ? 'bg-blue-100 text-blue-700' : app.status === 'shortlisted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Teacher: Assigned Batches */}
          {editData.role === 'teacher' && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-[#1A1A1A]" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Assigned Batches</h3>
              </div>
              {teacherBatches.length === 0 ? (
                <p className="text-sm text-gray-500">No batches assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {teacherBatches.map((batch) => {
                    const batchStudentCount = students.filter((s) => s.batchId === batch.id).length;
                    return (
                      <div key={batch.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A1A]">{batch.name}</p>
                          <p className="text-xs text-gray-500">{batch.startDate} to {batch.endDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users size={12} />
                            {batchStudentCount} students
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            batch.status === 'active' ? 'bg-green-100 text-green-700' : batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {batch.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Role</p>
                  <p className="text-sm font-medium text-[#1A1A1A]">{roleLabels[editData.role]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${editData.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm font-medium text-[#1A1A1A] capitalize">{editData.status}</p>
                </div>
              </div>
              {editData.role === 'student' && editData.batchName && (
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Batch</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{editData.batchName}</p>
                  </div>
                </div>
              )}
              {editData.role === 'teacher' && editData.specialization && (
                <div className="flex items-center gap-3">
                  <BookOpen size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Specialization</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{editData.specialization}</p>
                  </div>
                </div>
              )}
              {editData.role === 'student' && editData.joinDate && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Join Date</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{editData.joinDate}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-2xl p-6 card-shadow border border-red-100">
            <h3 className="text-sm font-semibold text-red-600 uppercase mb-3">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-4">
              {editData.status === 'active'
                ? 'Deactivating this user will prevent them from logging in.'
                : 'Reactivating this user will restore their access.'}
            </p>
            <button
              onClick={() => setShowDeactivateDialog(true)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                editData.status === 'active'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {editData.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate/Reactivate Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editData.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editData.status === 'active'
                ? `Are you sure you want to deactivate ${editData.name}? They will no longer be able to log in.`
                : `Are you sure you want to reactivate ${editData.name}? They will regain access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={toggleStatus}
              className={editData.status === 'active' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
            >
              {editData.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
