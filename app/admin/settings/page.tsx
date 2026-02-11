'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { Minus, Plus, Save, Monitor } from 'lucide-react';

export default function AdminSettings() {
  const [deviceLimit, setDeviceLimit] = useState(2);
  const [saved, setSaved] = useState(false);

  const decrease = () => {
    if (deviceLimit > 1) {
      setDeviceLimit(deviceLimit - 1);
      setSaved(false);
    }
  };

  const increase = () => {
    setDeviceLimit(deviceLimit + 1);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Settings" subtitle="Configure system-wide settings" />

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center">
              <Monitor size={20} className="text-[#1A1A1A]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1A1A1A]">Session Settings</h3>
              <p className="text-xs text-gray-500">Control how many devices users can be logged in on simultaneously</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 sm:p-5 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Maximum Devices Per User
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={decrease}
                disabled={deviceLimit <= 1}
                className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus size={18} className="text-gray-600" />
              </button>
              <div className="w-16 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center">
                <span className="text-2xl font-bold text-[#1A1A1A]">{deviceLimit}</span>
              </div>
              <button
                onClick={increase}
                className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Plus size={18} className="text-gray-600" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Users who exceed this limit will have their oldest session terminated automatically. Minimum: 1 device.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
