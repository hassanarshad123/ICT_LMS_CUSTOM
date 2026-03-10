import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        <p className="text-gray-500 mb-4">Page not found</p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
