export interface JobOut {
  id: string;
  title: string;
  company: string;
  location?: string;
  type: string;
  salary?: string;
  description?: string;
  requirements?: string[];
  postedDate?: string;
  deadline?: string;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle?: string;
  company?: string;
  status: string;
  coverLetter?: string;
  appliedAt?: string;
}
