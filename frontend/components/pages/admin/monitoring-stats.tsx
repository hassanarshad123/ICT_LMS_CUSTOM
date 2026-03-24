'use client';

import { ErrorStats } from '@/lib/api/monitoring';
import {
  AlertCircle,
  AlertTriangle,
  Monitor,
  Smartphone,
  Zap,
} from 'lucide-react';

export interface MonitoringStatsProps {
  stats: ErrorStats;
}

export function MonitoringStats({ stats }: MonitoringStatsProps) {
  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <span className="text-sm text-gray-500">Errors (24h)</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.totalErrors24h}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-orange-500" />
            </div>
            <span className="text-sm text-gray-500">Unresolved</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.unresolvedCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Monitor size={20} className="text-blue-500" />
            </div>
            <span className="text-sm text-gray-500">Backend</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.errorsBySource?.backend ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Smartphone size={20} className="text-purple-500" />
            </div>
            <span className="text-sm text-gray-500">Frontend</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.errorsBySource?.frontend ?? 0}</p>
        </div>
      </div>

      {/* Top Error Paths */}
      {(stats.topPaths ?? []).length > 0 && (
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <Zap size={16} className="text-orange-500" />
            Most Affected Endpoints (24h)
          </h3>
          <div className="flex flex-wrap gap-2">
            {(stats.topPaths ?? []).map((p) => (
              <span
                key={p.path}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-700"
              >
                {p.path}
                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-semibold">
                  {p.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
