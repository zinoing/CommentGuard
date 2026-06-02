import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">CommentGuard</h1>
        <Link href="/dashboard/comments" className="text-brand-blue hover:underline text-sm">
          Dashboard →
        </Link>
      </nav>
      <div className="max-w-4xl mx-auto py-16 px-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Comment Monitoring & Legal Evidence Platform</h2>
        <p className="text-gray-600 text-lg mb-8">
          Collect, classify, and preserve YouTube/Instagram comments as legal-grade evidence.
        </p>
        <Link
          href="/dashboard/comments"
          className="bg-brand-blue text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-brand-blue-dark transition-colors"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
