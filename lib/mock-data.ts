import { Batch, Student, Teacher, Lecture, ZoomClass, Job, CurriculumModule } from './types';

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

export const students: Student[] = [
  { id: 's1', name: 'Muhammad Imran', email: 'imran@email.com', phone: '0300-1234567', batchId: 'b3', batchName: 'Batch 3 - August 2024', joinDate: '2024-08-01', status: 'active' },
  { id: 's2', name: 'Ayesha Siddiqui', email: 'ayesha@email.com', phone: '0321-2345678', batchId: 'b3', batchName: 'Batch 3 - August 2024', joinDate: '2024-08-01', status: 'active' },
  { id: 's3', name: 'Hassan Raza', email: 'hassan@email.com', phone: '0333-3456789', batchId: 'b3', batchName: 'Batch 3 - August 2024', joinDate: '2024-08-01', status: 'active' },
  { id: 's4', name: 'Sana Malik', email: 'sana@email.com', phone: '0345-4567890', batchId: 'b3', batchName: 'Batch 3 - August 2024', joinDate: '2024-08-02', status: 'active' },
  { id: 's5', name: 'Ali Ahmed', email: 'ali@email.com', phone: '0312-5678901', batchId: 'b3', batchName: 'Batch 3 - August 2024', joinDate: '2024-08-01', status: 'active' },
  { id: 's6', name: 'Zainab Fatima', email: 'zainab@email.com', phone: '0300-6789012', batchId: 'b2', batchName: 'Batch 2 - April 2024', joinDate: '2024-04-20', status: 'active' },
  { id: 's7', name: 'Bilal Hussain', email: 'bilal@email.com', phone: '0321-7890123', batchId: 'b2', batchName: 'Batch 2 - April 2024', joinDate: '2024-04-20', status: 'active' },
  { id: 's8', name: 'Nadia Khan', email: 'nadia@email.com', phone: '0333-8901234', batchId: 'b1', batchName: 'Batch 1 - January 2024', joinDate: '2024-01-15', status: 'inactive' },
  { id: 's9', name: 'Tariq Mehmood', email: 'tariq@email.com', phone: '0345-9012345', batchId: 'b4', batchName: 'Batch 4 - December 2024', joinDate: '2024-12-01', status: 'active' },
  { id: 's10', name: 'Rabia Aslam', email: 'rabia@email.com', phone: '0312-0123456', batchId: 'b4', batchName: 'Batch 4 - December 2024', joinDate: '2024-12-01', status: 'active' },
];

export const teachers: Teacher[] = [
  { id: 't1', name: 'Ahmed Khan', email: 'ahmed@ict.edu.pk', phone: '0300-1111111', specialization: 'Web Development', batchIds: ['b1', 'b3'], status: 'active' },
  { id: 't2', name: 'Fatima Noor', email: 'fatima@ict.edu.pk', phone: '0321-2222222', specialization: 'Digital Marketing', batchIds: ['b2'], status: 'active' },
  { id: 't3', name: 'Usman Ali', email: 'usman@ict.edu.pk', phone: '0333-3333333', specialization: 'Data Science', batchIds: ['b4'], status: 'active' },
];

export const lectures: Lecture[] = [
  { id: 'l1', title: 'Introduction to Computing', description: 'Learn the basics of computers and how they work in everyday business.', videoUrl: '#', duration: '45 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-02', order: 1 },
  { id: 'l2', title: 'Microsoft Office Basics', description: 'Master Word, Excel, and PowerPoint for your daily work.', videoUrl: '#', duration: '1 hr 10 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-05', order: 2 },
  { id: 'l3', title: 'Internet & Email', description: 'How to use the internet safely and manage emails professionally.', videoUrl: '#', duration: '50 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-09', order: 3 },
  { id: 'l4', title: 'Data Management', description: 'Organize and manage your business data effectively using spreadsheets.', videoUrl: '#', duration: '55 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-12', order: 4 },
  { id: 'l5', title: 'Digital Marketing Basics', description: 'Learn how to promote your business online using social media.', videoUrl: '#', duration: '1 hr 5 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-16', order: 5 },
  { id: 'l6', title: 'Cybersecurity Awareness', description: 'Protect your business from online threats and scams.', videoUrl: '#', duration: '40 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-19', order: 6 },
  { id: 'l7', title: 'Cloud Storage & Google Drive', description: 'Store and share files securely using cloud services.', videoUrl: '#', duration: '35 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-23', order: 7 },
  { id: 'l8', title: 'Online Communication Tools', description: 'Use Zoom, WhatsApp Business, and other tools for professional communication.', videoUrl: '#', duration: '50 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-26', order: 8 },
];

export const zoomClasses: ZoomClass[] = [
  { id: 'z1', title: 'Week 12 - Final Project Review', batchId: 'b3', batchName: 'Batch 3 - August 2024', teacherName: 'Ahmed Khan', zoomLink: 'https://zoom.us/j/example1', date: '2024-10-28', time: '10:00 AM', duration: '1.5 hours', status: 'upcoming' },
  { id: 'z2', title: 'Week 11 - Cybersecurity Q&A', batchId: 'b3', batchName: 'Batch 3 - August 2024', teacherName: 'Ahmed Khan', zoomLink: 'https://zoom.us/j/example2', date: '2024-10-21', time: '10:00 AM', duration: '1.5 hours', status: 'completed' },
  { id: 'z3', title: 'Week 10 - Digital Marketing Workshop', batchId: 'b3', batchName: 'Batch 3 - August 2024', teacherName: 'Ahmed Khan', zoomLink: 'https://zoom.us/j/example3', date: '2024-10-14', time: '10:00 AM', duration: '2 hours', status: 'completed' },
  { id: 'z4', title: 'Orientation - Batch 4', batchId: 'b4', batchName: 'Batch 4 - December 2024', teacherName: 'Usman Ali', zoomLink: 'https://zoom.us/j/example4', date: '2024-12-02', time: '11:00 AM', duration: '1 hour', status: 'upcoming' },
  { id: 'z5', title: 'Week 1 - Getting Started', batchId: 'b4', batchName: 'Batch 4 - December 2024', teacherName: 'Usman Ali', zoomLink: 'https://zoom.us/j/example5', date: '2024-12-09', time: '11:00 AM', duration: '1.5 hours', status: 'upcoming' },
];

export const jobs: Job[] = [
  { id: 'j1', title: 'Data Entry Operator', company: 'TechVentures Lahore', location: 'Lahore', type: 'full-time', salary: 'PKR 35,000 - 45,000', description: 'Enter and manage business data using Microsoft Excel and company software.', requirements: ['Basic computer skills', 'MS Office proficiency', 'Attention to detail'], postedDate: '2024-10-15', deadline: '2024-11-15' },
  { id: 'j2', title: 'Social Media Manager', company: 'BrandPro Marketing', location: 'Karachi', type: 'remote', salary: 'PKR 40,000 - 55,000', description: 'Manage social media accounts for small businesses and create engaging content.', requirements: ['Social media knowledge', 'Content creation', 'Basic design skills'], postedDate: '2024-10-18', deadline: '2024-11-30' },
  { id: 'j3', title: 'IT Support Assistant', company: 'Global Systems Islamabad', location: 'Islamabad', type: 'full-time', salary: 'PKR 30,000 - 40,000', description: 'Provide basic IT support to office staff including troubleshooting hardware and software.', requirements: ['Hardware knowledge', 'Software troubleshooting', 'Good communication'], postedDate: '2024-10-20', deadline: '2024-11-20' },
  { id: 'j4', title: 'Office Administrator', company: 'LegalEase Associates', location: 'Lahore', type: 'full-time', salary: 'PKR 45,000 - 60,000', description: 'Manage office operations, schedule meetings, and handle digital correspondence.', requirements: ['MS Office expertise', 'Organizational skills', 'Email management'], postedDate: '2024-10-22', deadline: '2024-12-01' },
  { id: 'j5', title: 'Digital Marketing Intern', company: 'StartUp Hub Karachi', location: 'Karachi', type: 'internship', salary: 'PKR 20,000 - 25,000', description: 'Learn and assist in running digital marketing campaigns for startup clients.', requirements: ['Eagerness to learn', 'Basic internet skills', 'Social media presence'], postedDate: '2024-10-25', deadline: '2024-11-25' },
  { id: 'j6', title: 'Freelance Content Writer', company: 'WriteWell Agency', location: 'Remote', type: 'part-time', salary: 'PKR 500 - 1,500 per article', description: 'Write blog posts and articles for business clients on various topics.', requirements: ['Good English writing', 'Research skills', 'Meeting deadlines'], postedDate: '2024-10-28', deadline: '2024-12-15' },
];

export const curriculum: CurriculumModule[] = [
  { id: 'c1', title: 'Module 1: Computer Fundamentals', description: 'Understanding computers, operating systems, and basic hardware.', order: 1, topics: ['What is a Computer?', 'Parts of a Computer', 'Windows Operating System', 'File Management'] },
  { id: 'c2', title: 'Module 2: Microsoft Office Suite', description: 'Master the essential office tools for daily business use.', order: 2, topics: ['Microsoft Word - Documents', 'Microsoft Excel - Spreadsheets', 'Microsoft PowerPoint - Presentations', 'Printing & Formatting'] },
  { id: 'c3', title: 'Module 3: Internet & Communication', description: 'Learn to use internet, email, and online communication tools effectively.', order: 3, topics: ['Web Browsers & Searching', 'Email (Gmail & Outlook)', 'Zoom & Video Calls', 'WhatsApp Business'] },
  { id: 'c4', title: 'Module 4: Digital Marketing', description: 'Promote your business online using social media and digital tools.', order: 4, topics: ['Social Media Marketing', 'Facebook & Instagram for Business', 'Google My Business', 'Content Creation Basics'] },
  { id: 'c5', title: 'Module 5: Data & Security', description: 'Manage your data safely and protect against online threats.', order: 5, topics: ['Data Organization', 'Cloud Storage (Google Drive)', 'Online Safety & Passwords', 'Avoiding Scams & Phishing'] },
  { id: 'c6', title: 'Module 6: Final Project', description: 'Apply everything you learned in a real-world business project.', order: 6, topics: ['Project Planning', 'Implementation', 'Presentation', 'Graduation'] },
];
