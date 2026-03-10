'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, HardDrive, Video, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { getPlatformDashboard, PlatformDashboard } from '@/lib/api/super-admin';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function SADashboard() {
  const [stats, setStats] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlatformDashboard()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl">{error || 'Failed to load dashboard'}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of all institutes on the platform</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Institutes" value={stats.totalInstitutes} icon={Building2} color="bg-blue-500" />
        <StatCard label="Active" value={stats.activeInstitutes} icon={TrendingUp} color="bg-green-500" />
        <StatCard label="Suspended" value={stats.suspendedInstitutes} icon={AlertCircle} color="bg-red-500" />
        <StatCard label="Trial" value={stats.trialInstitutes} icon={Clock} color="bg-yellow-500" />
      </div>

      {/* Usage cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} color="bg-purple-500" />
        <StatCard label="Total Storage" value={`${stats.totalStorageGb} GB`} icon={HardDrive} color="bg-indigo-500" />
        <StatCard label="Total Video" value={`${stats.totalVideoGb} GB`} icon={Video} color="bg-pink-500" />
      </div>

      {/* Plan breakdown + recent institutes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Institutes by Plan</h2>
          <div className="space-y-3">
            {Object.entries(stats.institutesByPlan).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-3">
                <div className="w-20 text-sm capitalize text-gray-600">{plan}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: stats.totalInstitutes > 0 ? `${((count as number) / stats.totalInstitutes) * 100}%` : '0%' }}
                  />
                </div>
                <div className="w-8 text-sm font-medium text-right">{count as number}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Institutes</h2>
            <Link href="/sa/institutes" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {stats.recentInstitutes.map((inst) => (
              <Link key={inst.id} href={`/sa/institutes/${inst.id}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{inst.name}</div>
                  <div className="text-xs text-gray-500">{inst.slug}.ict.zensbot.site</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  inst.status === 'active' ? 'bg-green-100 text-green-700' :
                  inst.status === 'suspended' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {inst.status}
                </span>
              </Link>
            ))}
            {stats.recentInstitutes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No institutes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
