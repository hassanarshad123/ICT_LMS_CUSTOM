'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import QuizBuilder from '@/components/pages/cc/quiz-builder';

export default function QuizBuilderPage() {
  const params = useParams();
  const { role } = useAuth();

  if (role !== 'course-creator') {
    return <div className="p-8 text-center text-gray-500">Access denied</div>;
  }

  return <QuizBuilder quizId={params.quizId as string} courseId={params.courseId as string} />;
}
