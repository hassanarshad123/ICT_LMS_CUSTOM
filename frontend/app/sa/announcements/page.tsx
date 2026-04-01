'use client';

import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  createAnnouncement, listAnnouncements, listInstitutes,
  type SAAnnouncement, type InstituteOut,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';
import { PageLoading, PageError } from '@/components/shared/page-states';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SAAnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: announcementsData, loading, error, refetch } = useApi(
    () => listAnnouncements({ per_page: 50 }), []
  );
  const { data: institutesData } = useApi(
    () => listInstitutes({ per_page: 100 }), []
  );

  const { execute: doSend, loading: sending } = useMutation(
    (data: any) => createAnnouncement(data)
  );

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    try {
      await doSend({
        title: title.trim(),
        message: message.trim(),
        targetInstituteIds: targetAll ? [] : selectedIds,
      });
      toast.success('Announcement sent');
      setTitle('');
      setMessage('');
      setSelectedIds([]);
      refetch();
    } catch {
      toast.error('Failed to send announcement');
    }
  };

  const toggleInstitute = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Announcements</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Send announcements to institute admins</p>
      </div>

      {/* Create Announcement */}
      <div className="bg-white rounded-2xl p-5 border border-zinc-200 space-y-4">
        <h2 className="font-semibold text-zinc-900">New Announcement</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message..."
          rows={4}
          className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm resize-none"
        />

        {/* Target Selection */}
        <div>
          <label className="text-xs text-zinc-500 block mb-2">Target</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTargetAll(true)}
              className={`px-3 py-1.5 text-xs rounded-lg ${targetAll ? 'bg-[#1A1A1A] text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              All Institutes
            </button>
            <button
              onClick={() => setTargetAll(false)}
              className={`px-3 py-1.5 text-xs rounded-lg ${!targetAll ? 'bg-[#1A1A1A] text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              Select Specific
            </button>
          </div>
          {!targetAll && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {(institutesData?.data || []).map((inst: InstituteOut) => (
                <button
                  key={inst.id}
                  onClick={() => toggleInstitute(inst.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    selectedIds.includes(inst.id)
                      ? 'bg-[#C5D86D] border-[#C5D86D] text-[#1A1A1A]'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {inst.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={!title.trim() || !message.trim() || sending || (!targetAll && selectedIds.length === 0)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl disabled:opacity-40"
            >
              <Send size={16} /> {sending ? 'Sending...' : 'Send Announcement'}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Announcement?</AlertDialogTitle>
              <AlertDialogDescription>
                This will notify {targetAll ? 'all institute admins' : `admins in ${selectedIds.length} selected institute(s)`}.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend}>Send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Announcement History</h2>
        </div>
        <div className="divide-y divide-zinc-50">
          {(announcementsData?.data || []).map((ann: SAAnnouncement) => (
            <div key={ann.id} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Megaphone size={14} className="text-[#C5D86D]" />
                    <span className="font-medium text-zinc-900">{ann.title}</span>
                  </div>
                  <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{ann.message}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-xs text-zinc-500">
                    {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                  </span>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {ann.targetInstituteIds.length === 0 ? 'All institutes' : `${ann.targetInstituteIds.length} institutes`}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!announcementsData?.data || announcementsData.data.length === 0) && (
            <div className="px-5 py-8 text-center text-zinc-400 text-sm">No announcements sent yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
