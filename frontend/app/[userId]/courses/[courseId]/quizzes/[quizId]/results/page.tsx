'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import QuizResults from '@/components/pages/cc/quiz-results';

export default function QuizResultsPage() {
  const params = useParams();
  const { role } = useAuth();

  if (role !== 'course-creator') {
    return <div className="p-8 text-center text-gray-500">Access denied</div>;
  }

  return <QuizResults quizId={params.quizId as string} courseId={params.courseId as string} />;
}
