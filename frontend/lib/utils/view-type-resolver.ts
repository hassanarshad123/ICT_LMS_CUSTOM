import type { ViewType } from '@/lib/types/rbac';

export function resolveViewComponent<T>(
  viewType: ViewType | null | undefined,
  map: {
    student_view: T;
    staff_view: T;
    admin_view: T;
  },
): T {
  if (!viewType) return map.student_view;
  return map[viewType] ?? map.student_view;
}

export const SYSTEM_ROLE_VIEW_TYPE: Record<string, ViewType> = {
  admin: 'admin_view',
  'course-creator': 'admin_view',
  teacher: 'staff_view',
  student: 'student_view',
  'admissions-officer': 'staff_view',
};
