'use client';

import { useState, ReactNode } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useMutation } from '@/hooks/use-api';
import { updateUser } from '@/lib/api/users';
import { changePassword } from '@/lib/api/auth';
import { toast } from 'sonner';
import { Save, User, Lock, Loader2 } from 'lucide-react';

interface SettingsViewProps {
  subtitle?: string;
  extraProfileFields?: ReactNode;
  extraCards?: ReactNode;
}

export default function SettingsView({ subtitle, extraProfileFields, extraCards }: SettingsViewProps) {
  const auth = useAuth();

  const [profileData, setProfileData] = useState({
    name: auth.name,
    email: auth.email,
    phone: auth.phone,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const { execute: doUpdateProfile, loading: savingProfile } = useMutation(updateUser);
  const { execute: doChangePassword, loading: savingPassword } = useMutation(changePassword);

  const handleProfileSave = async () => {
    if (!auth.id) return;
    try {
      await doUpdateProfile(auth.id, {
        name: profileData.name,
        phone: profileData.phone,
      });
      toast.success('Profile updated');
      // Update localStorage user
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          user.name = profileData.name;
          user.phone = profileData.phone;
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePasswordUpdate = async () => {
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }
    try {
      await doChangePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Password updated');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Settings" subtitle={subtitle} />

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Account Settings</h3>
              <p className="text-xs text-gray-500">Update your personal information</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={profileData.email} disabled className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
            {extraProfileFields}
          </div>

          <button onClick={handleProfileSave} disabled={savingProfile} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
            {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Profile
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Lock size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Change Password</h3>
              <p className="text-xs text-gray-500">Update your account password</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" placeholder="Enter current password" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" placeholder="Enter new password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" placeholder="Confirm new password" />
              </div>
            </div>
            {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
          </div>

          <button onClick={handlePasswordUpdate} disabled={savingPassword} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
            {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Update Password
          </button>
        </div>

        {extraCards}
      </div>
    </DashboardLayout>
  );
}
