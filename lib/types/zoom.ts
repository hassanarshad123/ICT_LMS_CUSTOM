export interface ZoomClass {
  id: string;
  title: string;
  batchId: string;
  batchName: string;
  teacherName: string;
  zoomLink: string;
  date: string;
  time: string;
  duration: string;
  status: 'upcoming' | 'live' | 'completed';
}

export interface ZoomAccount {
  id: string;
  accountName: string;
  accountId: string;
  clientId: string;
  clientSecret: string;
  isDefault: boolean;
}
