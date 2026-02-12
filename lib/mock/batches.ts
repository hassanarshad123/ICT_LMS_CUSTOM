import { Batch } from '../types';

export const batches: Batch[] = [
  {
    id: 'b1',
    name: 'Batch 1 - January 2024',
    startDate: '2024-01-15',
    endDate: '2024-04-15',
    studentCount: 28,
    teacherId: 't1',
    teacherName: 'Ahmed Khan',
    status: 'completed',
  },
  {
    id: 'b2',
    name: 'Batch 2 - April 2024',
    startDate: '2024-04-20',
    endDate: '2024-07-20',
    studentCount: 32,
    teacherId: 't2',
    teacherName: 'Fatima Noor',
    status: 'completed',
  },
  {
    id: 'b3',
    name: 'Batch 3 - August 2024',
    startDate: '2024-08-01',
    endDate: '2024-11-01',
    studentCount: 25,
    teacherId: 't1',
    teacherName: 'Ahmed Khan',
    status: 'active',
  },
  {
    id: 'b4',
    name: 'Batch 4 - December 2024',
    startDate: '2024-12-01',
    endDate: '2025-03-01',
    studentCount: 15,
    teacherId: 't3',
    teacherName: 'Usman Ali',
    status: 'upcoming',
  },
];
