'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import QuizTake from '@/components/pages/student/quiz-take';

export default function QuizTakePage() {
  const params = useParams();
  const { role } = useAuth();

  if (role !== 'student') {
    return <div className="p-8 text-center text-gray-500">Access denied</div>;
  }

  return <QuizTake quizId={params.quizId as string} courseId={params.courseId as string} />;
}
