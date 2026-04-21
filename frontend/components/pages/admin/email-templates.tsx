'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Save, Loader2, RotateCcw, Eye, Code, Copy, Check,
} from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  listEmailTemplates, getEmailTemplate, updateEmailTemplate,
  resetEmailTemplate, previewEmailTemplate,
  EmailTemplateItem, EmailTemplateDetail, PreviewResponse,
} from '@/lib/api/email-templates';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CATEGORY_LABELS: Record<string, string> = {
  student_lifecycle: 'Student Lifecycle',
  batch_access: 'Batch Access',
  communication: 'Communication',
  classes: 'Live Classes',
  fees: 'Fee Management',
  billing: 'Billing',
  system: 'System',
};

const CATEGORY_ORDER = [
  'student_lifecycle', 'batch_access', 'communication',
  'classes', 'fees', 'billing', 'system',
];

export default function EmailTemplatesPage() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (selectedKey) {
    return <TemplateEditor templateKey={selectedKey} onBack={() => setSelectedKey(null)} />;
  }
  return <TemplateList onSelect={setSelectedKey} />;
}


function TemplateList({ onSelect }: { onSelect: (key: string) => void }) {
  const { data: templates, loading } = useApi(listEmailTemplates, []);

  const grouped = (templates || []).reduce<Record<string, EmailTemplateItem[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Templates</h3>
        <p className="text-sm text-gray-500">Customize the emails sent to your students and staff. Changes apply to your institute only.</p>
      </div>

      {loading ? (
        <div className="animate-pulse bg-gray-100 rounded-xl h-60" />
      ) : (
        CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => (
          <div key={cat}>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[cat] || cat}
            </h4>
            <div className="space-y-1">
              {grouped[cat].map(t => (
                <button
                  key={t.key}
                  onClick={() => onSelect(t.key)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Subject: {t.subject}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.isCustom && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        Customized
                      </span>
                    )}
                    <Code size={14} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}


function TemplateEditor({ templateKey, onBack }: { templateKey: string; onBack: () => void }) {
  const { data: template, loading } = useApi(() => getEmailTemplate(templateKey), [templateKey]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.bodyHtml);
      setDirty(false);
    }
  }, [template]);

  const { execute: save, loading: saving } = useMutation(async () => {
    const result = await updateEmailTemplate(templateKey, subject, bodyHtml);
    toast.success('Template saved');
    setDirty(false);
    return result;
  });

  const { execute: reset, loading: resetting } = useMutation(async () => {
    const result = await resetEmailTemplate(templateKey);
    setSubject(result.defaultSubject);
    setBodyHtml(result.defaultBody);
    toast.success('Template reset to default');
    setDirty(false);
    setShowResetDialog(false);
    return result;
  });

  const { execute: loadPreview, loading: previewing } = useMutation(async () => {
    const result = await previewEmailTemplate(templateKey, subject, bodyHtml);
    setPreview(result);
    setShowPreview(true);
    return result;
  });

  const insertVariable = useCallback((varName: string) => {
    const textarea = document.getElementById('body-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tag = `{{${varName}}}`;
    const newBody = bodyHtml.slice(0, start) + tag + bodyHtml.slice(end);
    setBodyHtml(newBody);
    setDirty(true);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  }, [bodyHtml]);

  if (loading || !template) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{template.label}</h3>
          <p className="text-xs text-gray-500">
            {template.isCustom ? 'Customized for your institute' : 'Using default template'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {template.isCustom && (
            <button
              onClick={() => setShowResetDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button
            onClick={loadPreview}
            disabled={previewing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Preview
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="Email subject..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Body HTML</label>
            <textarea
              id="body-editor"
              value={bodyHtml}
              onChange={(e) => { setBodyHtml(e.target.value); setDirty(true); }}
              rows={20}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
              placeholder="<h2>Your email content...</h2>"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 h-fit">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Available Variables
          </h4>
          <div className="space-y-1.5">
            {Object.entries(template.variables).map(([varName, desc]) => (
              <VariableButton key={varName} name={varName} description={desc as string} onInsert={insertVariable} />
            ))}
          </div>
        </div>
      </div>

      {showPreview && preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="text-sm font-medium text-gray-900">Preview</div>
                <div className="text-xs text-gray-500">Subject: {preview.subject}</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <iframe
              srcDoc={preview.html}
              className="w-full h-[70vh] border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Default?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard your customizations and revert to the system default template. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reset} className="bg-red-600 hover:bg-red-700">
              {resetting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Reset Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function VariableButton({ name, description, onInsert }: { name: string; description: string; onInsert: (name: string) => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        onInsert(name);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white text-left transition-colors group"
      title={description}
    >
      <div>
        <code className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{`{{${name}}}`}</code>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[160px]">{description}</div>
      </div>
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-300 group-hover:text-gray-400" />}
    </button>
  );
}
