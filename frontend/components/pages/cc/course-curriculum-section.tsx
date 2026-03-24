'use client';

import type { CurriculumModuleOut } from '@/lib/api/curriculum';
import {
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Loader2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ModuleFormState {
  title: string;
  description: string;
  topics: string;
}

export interface CourseCurriculumSectionProps {
  sortedModules: CurriculumModuleOut[];
  showModuleForm: boolean;
  moduleForm: ModuleFormState;
  editingModuleId: string | null;
  editForm: ModuleFormState;
  expandedModule: string | null;
  deleteModuleId: string | null;
  creatingModule: boolean;
  onSetShowModuleForm: (show: boolean) => void;
  onSetModuleForm: (form: ModuleFormState) => void;
  onSetEditingModuleId: (id: string | null) => void;
  onSetEditForm: (form: ModuleFormState) => void;
  onSetExpandedModule: (id: string | null) => void;
  onSetDeleteModuleId: (id: string | null) => void;
  onAddModule: (e: React.FormEvent) => void;
  onUpdateModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
}

export function CourseCurriculumSection({
  sortedModules,
  showModuleForm,
  moduleForm,
  editingModuleId,
  editForm,
  expandedModule,
  deleteModuleId,
  creatingModule,
  onSetShowModuleForm,
  onSetModuleForm,
  onSetEditingModuleId,
  onSetEditForm,
  onSetExpandedModule,
  onSetDeleteModuleId,
  onAddModule,
  onUpdateModule,
  onDeleteModule,
}: CourseCurriculumSectionProps) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Curriculum</h3>
          {!showModuleForm && (
            <button
              onClick={() => onSetShowModuleForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add Module
            </button>
          )}
        </div>

        {showModuleForm && (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
            <h4 className="text-sm font-semibold text-primary mb-4">New Module</h4>
            <form onSubmit={onAddModule} className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => onSetModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder="Module title"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={moduleForm.description}
                  onChange={(e) => onSetModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder="Module description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Topics (comma separated)</label>
                <input
                  type="text"
                  value={moduleForm.topics}
                  onChange={(e) => onSetModuleForm({ ...moduleForm, topics: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder="Topic 1, Topic 2, Topic 3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingModule}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
                >
                  {creatingModule && <Loader2 size={16} className="animate-spin" />}
                  Add Module
                </button>
                <button
                  type="button"
                  onClick={() => { onSetShowModuleForm(false); onSetModuleForm({ title: '', description: '', topics: '' }); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {sortedModules.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center">
            <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No curriculum modules yet. Add your first module.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedModules.map((mod) => {
              const isEditing = editingModuleId === mod.id;
              const isExpanded = expandedModule === mod.id;
              return (
                <div key={mod.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                  {isEditing ? (
                    <div className="p-4">
                      <div className="space-y-3 mb-3">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => onSetEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary"
                          placeholder="Module title"
                        />
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => onSetEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary"
                          placeholder="Description"
                        />
                        <input
                          type="text"
                          value={editForm.topics}
                          onChange={(e) => onSetEditForm({ ...editForm, topics: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary"
                          placeholder="Topic 1, Topic 2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onUpdateModule(mod.id)}
                          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => onSetEditingModuleId(null)}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4">
                        <button
                          onClick={() => onSetExpandedModule(isExpanded ? null : mod.id)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{mod.sequenceOrder}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-primary">{mod.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                          </div>
                          {(mod.topics || []).length > 0 && (
                            isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
                          )}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onSetEditingModuleId(mod.id);
                              onSetEditForm({
                                title: mod.title,
                                description: mod.description || '',
                                topics: (mod.topics || []).join(', '),
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onSetDeleteModuleId(mod.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (mod.topics || []).length > 0 && (
                        <div className="px-4 pb-4">
                          <div className="ml-11 border-t border-gray-100 pt-3">
                            <ul className="space-y-1.5">
                              {(mod.topics ?? []).map((topic, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                  {topic}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteModuleId} onOpenChange={(open) => !open && onSetDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this curriculum module? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteModuleId && onDeleteModule(deleteModuleId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
