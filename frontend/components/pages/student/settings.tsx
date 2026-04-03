'use client';

import { useState, useEffect, useRef } from 'react';
import SettingsView from '@/components/shared/settings-view';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { getEmailPreferences, updateEmailPreferences, type EmailPreferenceItem } from '@/lib/api/users';
import { Mail, Save, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentSettings() {
  const { batchNames } = useAuth();
  const basePath = useBasePath();

  const { data: prefData } = useApi(() => getEmailPreferences(), []);
  const [prefs, setPrefs] = useState<EmailPreferenceItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (prefData?.preferences && !initialized) {
      setPrefs(prefData.preferences);
      setInitialized(true);
    }
  }, [prefData, initialized]);

  const { execute: doSave, loading: saving } = useMutation(
    (p: Array<{ emailType: string; subscribed: boolean }>) => updateEmailPreferences(p),
  );
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = async () => {
    try {
      await doSave(prefs.map((p) => ({ emailType: p.emailType, subscribed: p.subscribed })));
      toast.success('Email preferences saved');
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  const togglePref = (emailType: string) => {
    setPrefs(prefs.map((p) =>
      p.emailType === emailType ? { ...p, subscribed: !p.subscribed } : p
    ));
  };

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
      extraCards={
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Mail size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Email Preferences</h3>
              <p className="text-xs text-gray-500">Manage which emails you receive</p>
            </div>
          </div>

          {prefs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading preferences...</p>
          ) : (
            <div className="space-y-2">
              {prefs.map((pref) => (
                <label key={pref.emailType} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pref.subscribed}
                    onChange={() => togglePref(pref.emailType)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{pref.label}</div>
                    <div className="text-xs text-gray-500">{pref.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || prefs.length === 0}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-primary hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      }
    />
  );
}
