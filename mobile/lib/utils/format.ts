import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export function formatDate(dateStr: string | undefined | null, fmt = 'MMM d, yyyy'): string {
  if (!dateStr) return '';
  const date = parseISO(dateStr);
  return isValid(date) ? format(date, fmt) : '';
}

export function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const date = parseISO(dateStr);
  if (!isValid(date)) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
