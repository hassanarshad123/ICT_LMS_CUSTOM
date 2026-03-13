'use client';

import { LectureOut } from '@/lib/api/lectures';
import SortableLectureCard from '@/components/shared/sortable-lecture-card';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  SensorDescriptor,
  SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  BookOpen,
  Plus,
  Trash2,
  Video,
  Upload,
  Paperclip,
  Loader2,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';

interface LectureFormState {
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
}

export interface BatchCourseContentProps {
  courses: any[];
  courseLectures: Record<string, LectureOut[]>;
  courseMaterials: Record<string, any[]>;
  loadingContent: Record<string, boolean>;
  basePath: string;

  /** DnD sensors from the parent (useSensors result) */
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent, courseId: string) => void;

  /** Lecture drawer trigger */
  onLectureClick: (lectureId: string) => void;

  /** External URL lecture form */
  showLectureForm: string | null;
  lectureForm: LectureFormState;
  creatingLecture: boolean;
  onShowLectureForm: (courseId: string) => void;
  onHideLectureForm: () => void;
  onLectureFormChange: (form: LectureFormState) => void;
  onAddLecture: (courseId: string) => void;

  /** Material form */
  showMaterialForm: string | null;
  materialFile: File | null;
  materialTitle: string;
  materialDescription: string;
  onShowMaterialForm: (courseId: string) => void;
  onHideMaterialForm: () => void;
  onMaterialFileChange: (file: File | null) => void;
  onMaterialTitleChange: (title: string) => void;
  onMaterialDescriptionChange: (description: string) => void;
  onUploadMaterial: (courseId: string) => void;

  /** Material delete */
  onDeleteMaterialConfirm: (materialId: string, courseId: string) => void;
}

export function BatchCourseContent({
  courses,
  courseLectures,
  courseMaterials,
  loadingContent,
  basePath,
  sensors,
  onDragEnd,
  onLectureClick,
  showLectureForm,
  lectureForm,
  creatingLecture,
  onShowLectureForm,
  onHideLectureForm,
  onLectureFormChange,
  onAddLecture,
  showMaterialForm,
  materialFile,
  materialTitle,
  materialDescription,
  onShowMaterialForm,
  onHideMaterialForm,
  onMaterialFileChange,
  onMaterialTitleChange,
  onMaterialDescriptionChange,
  onUploadMaterial,
  onDeleteMaterialConfirm,
}: BatchCourseContentProps) {
  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 card-shadow text-center">
        <BookOpen size={28} className="text-gray-300 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-primary mb-2">No courses linked</h3>
        <p className="text-sm text-gray-500">Assign this batch to a course to start managing content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {courses.map((course: any) => {
        const lectures = courseLectures[course.id] || [];
        const materials = courseMaterials[course.id] || [];
        const isContentLoading = loadingContent[course.id];

        return (
          <div key={course.id} className="space-y-6">
            {/* Course Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-primary">{course.title}</h2>
            </div>

            {isContentLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 size={16} className="animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Loading content...</span>
              </div>
            ) : (
              <>
                {/* Lectures Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Lectures</h3>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${basePath}/upload`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                      >
                        <Upload size={14} />
                        Upload Videos
                      </Link>
                      {showLectureForm !== course.id && (
                        <button
                          onClick={() => onShowLectureForm(course.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          <LinkIcon size={14} />
                          Add External URL
                        </button>
                      )}
                    </div>
                  </div>

                  {/* External URL form (inline) */}
                  {showLectureForm === course.id && (
                    <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                      <h4 className="text-sm font-semibold text-primary mb-4">Add External Video</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                          <input
                            type="text"
                            value={lectureForm.title}
                            onChange={(e) => onLectureFormChange({ ...lectureForm, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="Lecture title"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes)</label>
                          <input
                            type="number"
                            value={lectureForm.duration}
                            onChange={(e) => onLectureFormChange({ ...lectureForm, duration: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="e.g. 45"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                          <input
                            type="text"
                            value={lectureForm.videoUrl}
                            onChange={(e) => onLectureFormChange({ ...lectureForm, videoUrl: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="https://youtube.com/watch?v=..."
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                          <input
                            type="text"
                            value={lectureForm.description}
                            onChange={(e) => onLectureFormChange({ ...lectureForm, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="Lecture description"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => onAddLecture(course.id)}
                          disabled={creatingLecture}
                          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
                        >
                          {creatingLecture && <Loader2 size={16} className="animate-spin" />}
                          Add Lecture
                        </button>
                        <button
                          onClick={onHideLectureForm}
                          className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {lectures.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                      <Video size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No lectures yet. Upload videos or add an external URL.</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => onDragEnd(event, course.id)}
                    >
                      <SortableContext
                        items={lectures.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {[...lectures]
                            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                            .map((lecture) => (
                              <SortableLectureCard
                                key={lecture.id}
                                lecture={lecture}
                                onClick={() => onLectureClick(lecture.id)}
                              />
                            ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Materials Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Materials</h3>
                    {showMaterialForm !== course.id && (
                      <button
                        onClick={() => onShowMaterialForm(course.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                      >
                        <Plus size={14} />
                        Upload Material
                      </button>
                    )}
                  </div>

                  {showMaterialForm === course.id && (
                    <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                      <h4 className="text-sm font-semibold text-primary mb-4">Upload New Material</h4>
                      <div className="space-y-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                          <input
                            type="text"
                            value={materialTitle}
                            onChange={(e) => onMaterialTitleChange(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="Material title"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                          <input
                            type="text"
                            value={materialDescription}
                            onChange={(e) => onMaterialDescriptionChange(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                            placeholder="Brief description"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                          <label className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer block hover:border-gray-300 transition-colors">
                            <Upload size={20} className="text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">
                              {materialFile ? materialFile.name : 'Click to browse or drag and drop'}
                            </p>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  onMaterialFileChange(f);
                                  if (!materialTitle) onMaterialTitleChange(f.name.replace(/\.[^.]+$/, ''));
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => onUploadMaterial(course.id)}
                          className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                        >
                          Upload
                        </button>
                        <button
                          onClick={onHideMaterialForm}
                          className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {materials.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                      <Paperclip size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No materials yet. Upload your first material.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {materials.map((material: any) => (
                        <div key={material.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                              <FileText size={18} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-primary">{material.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                <span>{material.fileName}</span>
                                {material.fileSize && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span>{material.fileSize}</span>
                                  </>
                                )}
                                {material.uploadDate && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span>{new Date(material.uploadDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onDeleteMaterialConfirm(material.id, course.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Separator between courses */}
            <div className="border-t border-gray-200" />
          </div>
        );
      })}
    </div>
  );
}
