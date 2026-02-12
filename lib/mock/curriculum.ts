import { CurriculumModule } from '../types';

export const curriculum: CurriculumModule[] = [
  { id: 'c1', courseId: 'cr1', title: 'Module 1: Computer Fundamentals', description: 'Understanding computers, operating systems, and basic hardware.', order: 1, topics: ['What is a Computer?', 'Parts of a Computer', 'Windows Operating System', 'File Management'] },
  { id: 'c2', courseId: 'cr1', title: 'Module 2: Microsoft Office Suite', description: 'Master the essential office tools for daily business use.', order: 2, topics: ['Microsoft Word - Documents', 'Microsoft Excel - Spreadsheets', 'Microsoft PowerPoint - Presentations', 'Printing & Formatting'] },
  { id: 'c3', courseId: 'cr1', title: 'Module 3: Internet & Communication', description: 'Learn to use internet, email, and online communication tools effectively.', order: 3, topics: ['Web Browsers & Searching', 'Email (Gmail & Outlook)', 'Zoom & Video Calls', 'WhatsApp Business'] },
  { id: 'c4', courseId: 'cr1', title: 'Module 4: Digital Marketing', description: 'Promote your business online using social media and digital tools.', order: 4, topics: ['Social Media Marketing', 'Facebook & Instagram for Business', 'Google My Business', 'Content Creation Basics'] },
  { id: 'c5', courseId: 'cr2', title: 'Module 5: Data & Security', description: 'Manage your data safely and protect against online threats.', order: 5, topics: ['Data Organization', 'Cloud Storage (Google Drive)', 'Online Safety & Passwords', 'Avoiding Scams & Phishing'] },
  { id: 'c6', courseId: 'cr2', title: 'Module 6: Final Project', description: 'Apply everything you learned in a real-world business project.', order: 6, topics: ['Project Planning', 'Implementation', 'Presentation', 'Graduation'] },
];
