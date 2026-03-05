'use client';
import SettingsView from '@/components/shared/settings-view';
import { useAuth } from '@/lib/auth-context';
export default function TeacherSettings() {
  const user = useAuth();
  return (
    <SettingsView
      role="teacher"
      userName="Ahmed Khan"
      subtitle="Manage your account"
      extraProfileFields={
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
          <input
            type="text"
            value={user.specialization || 'Web Development'}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 opacity-60 cursor-not-allowed"
          />
        </div>
      }
    />
  );
}
