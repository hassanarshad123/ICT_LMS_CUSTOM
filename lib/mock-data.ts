import { Batch, Student, Teacher, CourseCreator, Course, Lecture, ZoomClass, Job, CurriculumModule, CourseMaterial, UnifiedUser, JobApplication } from './types';

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

export const courseCreators: CourseCreator[] = [
  { id: 'cc1', name: 'Asad Mehmood', email: 'asad@ict.edu.pk', phone: '0300-4444444', status: 'active' },
  { id: 'cc2', name: 'Sara Javed', email: 'sara@ict.edu.pk', phone: '0321-5555555', status: 'active' },
];

export const courses: Course[] = [
  { id: 'cr1', title: 'ICT Fundamentals', description: 'Complete course covering computer basics, office tools, internet usage, and data management for everyday business.', batchIds: ['b3'], status: 'active' },
  { id: 'cr2', title: 'Digital Skills & Security', description: 'Learn digital marketing, cybersecurity, cloud tools, and professional online communication.', batchIds: ['b3'], status: 'active' },
  { id: 'cr3', title: 'Data Science Essentials', description: 'Introduction to data science concepts, Python basics, and data visualization techniques.', batchIds: ['b4'], status: 'upcoming' },
];

export const lectures: Lecture[] = [
  { id: 'l1', title: 'Introduction to Computing', description: 'Learn the basics of computers and how they work in everyday business.', videoUrl: '#', duration: '45 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-02', order: 1, courseId: 'cr1' },
  { id: 'l2', title: 'Microsoft Office Basics', description: 'Master Word, Excel, and PowerPoint for your daily work.', videoUrl: '#', duration: '1 hr 10 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-05', order: 2, courseId: 'cr1' },
  { id: 'l3', title: 'Internet & Email', description: 'How to use the internet safely and manage emails professionally.', videoUrl: '#', duration: '50 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-09', order: 3, courseId: 'cr1' },
  { id: 'l4', title: 'Data Management', description: 'Organize and manage your business data effectively using spreadsheets.', videoUrl: '#', duration: '55 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-12', order: 4, courseId: 'cr1' },
  { id: 'l5', title: 'Digital Marketing Basics', description: 'Learn how to promote your business online using social media.', videoUrl: '#', duration: '1 hr 5 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-16', order: 5, courseId: 'cr1' },
  { id: 'l6', title: 'Cybersecurity Awareness', description: 'Protect your business from online threats and scams.', videoUrl: '#', duration: '40 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-19', order: 6, courseId: 'cr2' },
  { id: 'l7', title: 'Cloud Storage & Google Drive', description: 'Store and share files securely using cloud services.', videoUrl: '#', duration: '35 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-23', order: 7, courseId: 'cr2' },
  { id: 'l8', title: 'Online Communication Tools', description: 'Use Zoom, WhatsApp Business, and other tools for professional communication.', videoUrl: '#', duration: '50 min', batchId: 'b3', batchName: 'Batch 3', uploadDate: '2024-08-26', order: 8, courseId: 'cr2' },
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
  { id: 'c1', courseId: 'cr1', title: 'Module 1: Computer Fundamentals', description: 'Understanding computers, operating systems, and basic hardware.', order: 1, topics: ['What is a Computer?', 'Parts of a Computer', 'Windows Operating System', 'File Management'] },
  { id: 'c2', courseId: 'cr1', title: 'Module 2: Microsoft Office Suite', description: 'Master the essential office tools for daily business use.', order: 2, topics: ['Microsoft Word - Documents', 'Microsoft Excel - Spreadsheets', 'Microsoft PowerPoint - Presentations', 'Printing & Formatting'] },
  { id: 'c3', courseId: 'cr1', title: 'Module 3: Internet & Communication', description: 'Learn to use internet, email, and online communication tools effectively.', order: 3, topics: ['Web Browsers & Searching', 'Email (Gmail & Outlook)', 'Zoom & Video Calls', 'WhatsApp Business'] },
  { id: 'c4', courseId: 'cr1', title: 'Module 4: Digital Marketing', description: 'Promote your business online using social media and digital tools.', order: 4, topics: ['Social Media Marketing', 'Facebook & Instagram for Business', 'Google My Business', 'Content Creation Basics'] },
  { id: 'c5', courseId: 'cr2', title: 'Module 5: Data & Security', description: 'Manage your data safely and protect against online threats.', order: 5, topics: ['Data Organization', 'Cloud Storage (Google Drive)', 'Online Safety & Passwords', 'Avoiding Scams & Phishing'] },
  { id: 'c6', courseId: 'cr2', title: 'Module 6: Final Project', description: 'Apply everything you learned in a real-world business project.', order: 6, topics: ['Project Planning', 'Implementation', 'Presentation', 'Graduation'] },
];

export const batchMaterials: CourseMaterial[] = [
  { id: 'm1', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr1', title: 'Computer Basics Handbook', description: 'Complete reference guide covering hardware, software, and operating system fundamentals.', fileName: 'computer-basics-handbook.pdf', fileUrl: '#', fileType: 'pdf', fileSize: '2.4 MB', uploadDate: '2024-08-03', uploadedBy: 'Asad Mehmood', uploadedByRole: 'course-creator' },
  { id: 'm2', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr1', title: 'Excel Practice Workbook', description: 'Hands-on exercises for spreadsheet formulas, formatting, and data management.', fileName: 'excel-practice-workbook.xlsx', fileUrl: '#', fileType: 'excel', fileSize: '1.8 MB', uploadDate: '2024-08-06', uploadedBy: 'Asad Mehmood', uploadedByRole: 'course-creator' },
  { id: 'm3', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr1', title: 'PowerPoint Templates Pack', fileName: 'pptx-templates-pack.pptx', fileUrl: '#', fileType: 'pptx', fileSize: '5.2 MB', uploadDate: '2024-08-10', uploadedBy: 'Sara Javed', uploadedByRole: 'course-creator' },
  { id: 'm4', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr1', title: 'Internet Safety Checklist', description: 'Step-by-step checklist for staying safe online and protecting your accounts.', fileName: 'internet-safety-checklist.pdf', fileUrl: '#', fileType: 'pdf', fileSize: '420 KB', uploadDate: '2024-08-14', uploadedBy: 'Ahmed Khan', uploadedByRole: 'teacher' },
  { id: 'm5', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr1', title: 'Business Letter Templates', description: 'Professional letter templates for common business correspondence.', fileName: 'business-letter-templates.docx', fileUrl: '#', fileType: 'word', fileSize: '890 KB', uploadDate: '2024-08-18', uploadedBy: 'Ahmed Khan', uploadedByRole: 'teacher' },
  { id: 'm6', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr2', title: 'Cybersecurity Best Practices', description: 'Comprehensive guide to protecting your digital assets and personal data.', fileName: 'cybersecurity-best-practices.pdf', fileUrl: '#', fileType: 'pdf', fileSize: '1.5 MB', uploadDate: '2024-08-20', uploadedBy: 'Asad Mehmood', uploadedByRole: 'course-creator' },
  { id: 'm7', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr2', title: 'Cloud Storage Comparison', description: 'Comparison spreadsheet of popular cloud storage services with pricing and features.', fileName: 'cloud-storage-comparison.xlsx', fileUrl: '#', fileType: 'excel', fileSize: '340 KB', uploadDate: '2024-08-24', uploadedBy: 'Sara Javed', uploadedByRole: 'course-creator' },
  { id: 'm8', batchId: 'b3', batchName: 'Batch 3', courseId: 'cr2', title: 'Email Etiquette Guide', fileName: 'email-etiquette-guide.docx', fileUrl: '#', fileType: 'word', fileSize: '650 KB', uploadDate: '2024-08-27', uploadedBy: 'Ahmed Khan', uploadedByRole: 'teacher' },
];

export function getAllUsers(): UnifiedUser[] {
  const studentUsers: UnifiedUser[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: 'student' as const,
    status: s.status,
    batchId: s.batchId,
    batchName: s.batchName,
    joinDate: s.joinDate,
  }));

  const teacherUsers: UnifiedUser[] = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone,
    role: 'teacher' as const,
    status: t.status,
    specialization: t.specialization,
    batchIds: t.batchIds,
  }));

  const ccUsers: UnifiedUser[] = courseCreators.map((cc) => ({
    id: cc.id,
    name: cc.name,
    email: cc.email,
    phone: cc.phone,
    role: 'course-creator' as const,
    status: cc.status,
  }));

  return [...studentUsers, ...teacherUsers, ...ccUsers];
}

export const jobApplications: JobApplication[] = [
  { id: 'ja1', jobId: 'j1', jobTitle: 'Data Entry Operator', company: 'TechVentures Lahore', appliedDate: '2024-10-20', status: 'applied' },
  { id: 'ja2', jobId: 'j2', jobTitle: 'Social Media Manager', company: 'BrandPro Marketing', appliedDate: '2024-10-25', status: 'shortlisted' },
  { id: 'ja3', jobId: 'j5', jobTitle: 'Digital Marketing Intern', company: 'StartUp Hub Karachi', appliedDate: '2024-10-28', status: 'rejected' },
];
