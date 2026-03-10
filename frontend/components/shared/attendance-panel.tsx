'use client';

import { useState } from 'react';
import { getAttendance, syncAttendance, AttendanceItem } from '@/lib/api/zoom';
import { toast } from 'sonner';
import {
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface AttendancePanelProps {
  classId: string;
  canSync?: boolean;
}

export default function AttendancePanel({ classId, canSync = false }: AttendancePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await getAttendance(classId);
      setAttendance(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded && attendance === null) {
      fetchAttendance();
    }
    setExpanded(!expanded);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncAttendance(classId);
      toast.success(result.synced > 0 ? `Synced ${result.synced} student(s)` : 'Attendance already synced');
      await fetchAttendance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync attendance');
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const attended = attendance?.filter((a) => a.attended) || [];
  const absent = attendance?.filter((a) => !a.attended) || [];

  return (
    <div className="mt-3">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
      >
        <Users size={14} />
        Attendance
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="mt-3 bg-gray-50 rounded-xl p-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : attendance && attendance.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">No attendance data yet.</p>
              {canSync && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
                >
                  {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Sync from Zoom
                </button>
              )}
            </div>
          ) : attendance ? (
            <>
              {/* Summary bar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 size={14} />
                    {attended.length} present
                  </span>
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <XCircle size={14} />
                    {absent.length} absent
                  </span>
                  <span className="text-gray-400">
                    {attendance.length} total
                  </span>
                </div>
                {canSync && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary hover:bg-white rounded-lg transition-colors disabled:opacity-60"
                    title="Re-sync attendance from Zoom"
                  >
                    {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Sync
                  </button>
                )}
              </div>

              {/* Attendance table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-200">
                      <th className="text-left pb-2 font-medium">Student</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                      <th className="text-center pb-2 font-medium hidden sm:table-cell">Join</th>
                      <th className="text-center pb-2 font-medium hidden sm:table-cell">Leave</th>
                      <th className="text-right pb-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 text-primary font-medium">{item.studentName || 'Unknown'}</td>
                        <td className="py-2 text-center">
                          {item.attended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              <CheckCircle2 size={10} />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-500 text-xs font-medium rounded-full">
                              <XCircle size={10} />
                              Absent
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center text-xs text-gray-500 hidden sm:table-cell">{formatTime(item.joinTime)}</td>
                        <td className="py-2 text-center text-xs text-gray-500 hidden sm:table-cell">{formatTime(item.leaveTime)}</td>
                        <td className="py-2 text-right text-xs text-gray-500">
                          {item.durationMinutes != null ? (
                            <span className="flex items-center gap-1 justify-end">
                              <Clock size={10} />
                              {item.durationMinutes} min
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
