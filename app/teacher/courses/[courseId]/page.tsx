'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { courses, curriculum, batchMaterials as initialMaterials, batches, teachers } from '@/lib/mock-data';
import { CourseMaterial, MaterialFileType } from '@/lib/types';
import { statusColors, fileTypeConfig } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, BookOpen, Clock, ChevronDown, ChevronUp, FileText, Download, Paperclip, Plus, Upload, Layers } from 'lucide-react';
import Link from 'next/link';



export default function TeacherCourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const user = useAuth();
  const teacher = teachers.find((t) => t.id === user.teacherId);
  const course = courses.find((c) => c.id === courseId);

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [materialList, setMaterialList] = useState<CourseMaterial[]>(initialMaterials);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', fileName: '', fileType: 'pdf' as MaterialFileType });

  const teacherBatchIds = teacher?.batchIds || [];
  const teacherBatchForCourse = course?.batchIds.find((bid) => teacherBatchIds.includes(bid));
  const materials = materialList.filter((m) => m.batchId === teacherBatchForCourse && m.courseId === courseId);

  const addMaterial = () => {
    if (!materialForm.title.trim() || !materialForm.fileName.trim()) return;
    const batchObj = batches.find((b) => b.id === teacherBatchForCourse);
    const newMaterial: CourseMaterial = {
      id: `m${Date.now()}`,
      batchId: teacherBatchForCourse || '',
      batchName: batchObj?.name || '',
      courseId,
      title: materialForm.title.trim(),
      description: materialForm.description.trim() || undefined,
      fileName: materialForm.fileName.trim(),
      fileUrl: '#',
      fileType: materialForm.fileType,
      fileSize: '0 KB',
      uploadDate: new Date().toISOString().split('T')[0],
      uploadedBy: user.name,
      uploadedByRole: 'teacher',
    };
    setMaterialList([...materialList, newMaterial]);
    setMaterialForm({ title: '', description: '', fileName: '', fileType: 'pdf' });
    setShowMaterialForm(false);
  };

  if (!course) {
    return (
      <DashboardLayout role="teacher" userName="Ahmed Khan">
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">The course you are looking for does not exist.</p>
          <Link href="/teacher/courses" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to My Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher" userName="Ahmed Khan">
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link href="/teacher/courses" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} />
          Back to My Courses
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-sm text-gray-300 max-w-2xl mb-3">{course.description}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[course.status]}`}>
                {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Layers size={14} />
                {course.batchIds.length} batch(es)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Modules */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Curriculum</h3>
        <div className="space-y-3">
          {curriculum.filter((m) => m.courseId === courseId).map((mod) => {
            const isExpanded = expandedModule === mod.id;
            return (
              <div key={mod.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#1A1A1A]">{mod.order}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-[#1A1A1A]">{mod.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-11 border-t border-gray-100 pt-3">
                      <ul className="space-y-2">
                        {mod.topics.map((topic, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C5D86D]" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Course Materials */}
      <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Paperclip size={20} className="text-[#1A1A1A]" />
            <h3 className="text-lg font-semibold text-[#1A1A1A]">Course Materials</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {materials.length}
            </span>
          </div>
          {!showMaterialForm && (
            <button
              onClick={() => setShowMaterialForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
            >
              <Plus size={14} />
              Upload Material
            </button>
          )}
        </div>

        {showMaterialForm && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">Upload New Material</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="Material title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">File Type</label>
                <select
                  value={materialForm.fileType}
                  onChange={(e) => setMaterialForm({ ...materialForm, fileType: e.target.value as MaterialFileType })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-white"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="word">Word</option>
                  <option value="pptx">PowerPoint</option>
                  <option value="image">Image</option>
                  <option value="archive">Archive</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="Brief description of the material"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center mb-2">
                  <Upload size={20} className="text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Click to browse or drag and drop</p>
                </div>
                <input
                  type="text"
                  value={materialForm.fileName}
                  onChange={(e) => setMaterialForm({ ...materialForm, fileName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="filename.pdf"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={addMaterial}
                className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
              >
                Upload
              </button>
              <button
                onClick={() => { setShowMaterialForm(false); setMaterialForm({ title: '', description: '', fileName: '', fileType: 'pdf' }); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {materials.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No materials uploaded for this course yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.map((material) => {
              const config = fileTypeConfig[material.fileType];
              return (
                <div key={material.id} className="border border-gray-100 rounded-xl p-4 flex items-start gap-4">
                  <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-[#1A1A1A] truncate">{material.title}</h4>
                    {material.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{material.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{material.fileSize}</span>
                      <span className="text-gray-300">|</span>
                      <span>{material.uploadDate}</span>
                      <span className="text-gray-300">|</span>
                      <span>by {material.uploadedBy}</span>
                    </div>
                  </div>
                  <button className="flex-shrink-0 p-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#333] transition-colors">
                    <Download size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
