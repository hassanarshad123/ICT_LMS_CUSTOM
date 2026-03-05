'use client';
import UsersListView from '@/components/shared/users-list-view';
export default function CourseCreatorUsersPage() {
  return <UsersListView role="course-creator" userName="Course Creator" basePath="/course-creator/users" />;
}
