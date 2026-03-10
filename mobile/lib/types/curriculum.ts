export interface CurriculumModuleOut {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  topics?: string[];
  sequenceOrder: number;
}
