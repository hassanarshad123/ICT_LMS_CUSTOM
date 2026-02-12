import { MaterialFileType } from './types';

export const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  upcoming: 'bg-yellow-100 text-yellow-700',
};

export const roleBadgeColors: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  teacher: 'bg-purple-100 text-purple-700',
  'course-creator': 'bg-orange-100 text-orange-700',
};

export const roleLabels: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  'course-creator': 'Course Creator',
};

export const fileTypeConfig: Record<MaterialFileType, { label: string; bgColor: string; textColor: string }> = {
  pdf: { label: 'PDF', bgColor: 'bg-red-50', textColor: 'text-red-600' },
  excel: { label: 'XLS', bgColor: 'bg-green-50', textColor: 'text-green-600' },
  word: { label: 'DOC', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  pptx: { label: 'PPT', bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
  image: { label: 'IMG', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
  archive: { label: 'ZIP', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
  other: { label: 'FILE', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
};

export const jobTypeColors: Record<string, string> = {
  'full-time': 'bg-green-100 text-green-700',
  'part-time': 'bg-blue-100 text-blue-700',
  internship: 'bg-yellow-100 text-yellow-700',
  remote: 'bg-teal-100 text-teal-700',
};
