import { Job, JobApplication } from '../types';

export const jobs: Job[] = [
  { id: 'j1', title: 'Data Entry Operator', company: 'TechVentures Lahore', location: 'Lahore', type: 'full-time', salary: 'PKR 35,000 - 45,000', description: 'Enter and manage business data using Microsoft Excel and company software.', requirements: ['Basic computer skills', 'MS Office proficiency', 'Attention to detail'], postedDate: '2024-10-15', deadline: '2024-11-15' },
  { id: 'j2', title: 'Social Media Manager', company: 'BrandPro Marketing', location: 'Karachi', type: 'remote', salary: 'PKR 40,000 - 55,000', description: 'Manage social media accounts for small businesses and create engaging content.', requirements: ['Social media knowledge', 'Content creation', 'Basic design skills'], postedDate: '2024-10-18', deadline: '2024-11-30' },
  { id: 'j3', title: 'IT Support Assistant', company: 'Global Systems Islamabad', location: 'Islamabad', type: 'full-time', salary: 'PKR 30,000 - 40,000', description: 'Provide basic IT support to office staff including troubleshooting hardware and software.', requirements: ['Hardware knowledge', 'Software troubleshooting', 'Good communication'], postedDate: '2024-10-20', deadline: '2024-11-20' },
  { id: 'j4', title: 'Office Administrator', company: 'LegalEase Associates', location: 'Lahore', type: 'full-time', salary: 'PKR 45,000 - 60,000', description: 'Manage office operations, schedule meetings, and handle digital correspondence.', requirements: ['MS Office expertise', 'Organizational skills', 'Email management'], postedDate: '2024-10-22', deadline: '2024-12-01' },
  { id: 'j5', title: 'Digital Marketing Intern', company: 'StartUp Hub Karachi', location: 'Karachi', type: 'internship', salary: 'PKR 20,000 - 25,000', description: 'Learn and assist in running digital marketing campaigns for startup clients.', requirements: ['Eagerness to learn', 'Basic internet skills', 'Social media presence'], postedDate: '2024-10-25', deadline: '2024-11-25' },
  { id: 'j6', title: 'Freelance Content Writer', company: 'WriteWell Agency', location: 'Remote', type: 'part-time', salary: 'PKR 500 - 1,500 per article', description: 'Write blog posts and articles for business clients on various topics.', requirements: ['Good English writing', 'Research skills', 'Meeting deadlines'], postedDate: '2024-10-28', deadline: '2024-12-15' },
];

export const jobApplications: JobApplication[] = [
  { id: 'ja1', jobId: 'j1', jobTitle: 'Data Entry Operator', company: 'TechVentures Lahore', appliedDate: '2024-10-20', status: 'applied' },
  { id: 'ja2', jobId: 'j2', jobTitle: 'Social Media Manager', company: 'BrandPro Marketing', appliedDate: '2024-10-25', status: 'shortlisted' },
  { id: 'ja3', jobId: 'j5', jobTitle: 'Digital Marketing Intern', company: 'StartUp Hub Karachi', appliedDate: '2024-10-28', status: 'rejected' },
];
