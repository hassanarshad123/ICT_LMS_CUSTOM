import { ZoomAccount } from '@/lib/types';

export const zoomAccounts: ZoomAccount[] = [
  {
    id: 'za1',
    accountName: 'ICT Main Account',
    accountId: 'ICT_MAIN_ACC_001',
    clientId: 'aB3cD4eF5gH6iJ7k',
    clientSecret: 'xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0e',
    isDefault: true,
  },
  {
    id: 'za2',
    accountName: 'ICT Backup Account',
    accountId: 'ICT_BACKUP_ACC_002',
    clientId: 'mN8oP9qR0sT1uV2w',
    clientSecret: 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0u',
    isDefault: false,
  },
];
