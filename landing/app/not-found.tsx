import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-serif text-zen-dark mb-2">404</h1>
        <p className="text-gray-500 mb-4">Page not found</p>
        <Link href="/" className="text-sm font-medium text-zen-purple hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
