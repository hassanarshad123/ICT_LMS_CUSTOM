export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'internship' | 'remote';
  salary: string;
  description: string;
  requirements: string[];
  postedDate: string;
  deadline: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: 'applied' | 'shortlisted' | 'rejected';
}
