import { router } from 'expo-router';

interface NotificationData {
  type?: string;
  courseId?: string;
  lectureId?: string;
  batchId?: string;
  classId?: string;
  jobId?: string;
  certId?: string;
}

export function handleNotificationNavigation(data: NotificationData): void {
  switch (data.type) {
    case 'course':
      if (data.courseId) {
        router.push(`/(tabs)/courses/${data.courseId}`);
      } else {
        router.push('/(tabs)/courses');
      }
      break;
    case 'lecture':
      if (data.courseId && data.lectureId) {
        router.push(`/(tabs)/courses/${data.courseId}/lecture/${data.lectureId}`);
      }
      break;
    case 'class':
    case 'zoom':
      router.push('/(tabs)/classes');
      break;
    case 'recording':
      router.push('/(tabs)/classes/recordings');
      break;
    case 'certificate':
      router.push('/(tabs)/profile/certificates');
      break;
    case 'job':
      router.push('/(tabs)/profile/jobs');
      break;
    case 'announcement':
      router.push('/(tabs)/notifications');
      break;
    default:
      router.push('/(tabs)/notifications');
      break;
  }
}
