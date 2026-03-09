'use client';

import SettingsView from '@/components/shared/settings-view';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';

export default function StudentSettings() {
  const { batchNames } = useAuth();
  const basePath = useBasePath();

  return (
    <SettingsView
      subtitle="Manage your account settings"
      extraProfileFields={
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
          <input
            type="text"
            value={batchNames?.join(', ') || 'No batch assigned'}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 opacity-60 cursor-not-allowed"
          />
        </div>
      }
    />
  );
}
