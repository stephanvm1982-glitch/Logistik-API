import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-900 mb-4">
          Welkom bij Logistik Portal
        </h1>
        <p className="text-lg text-blue-700 mb-8">
          Vrachtbeheer voor Ecuador & Colombia
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg"
        >
          → Ga naar Dashboard
        </Link>
      </div>
    </div>
  );
}
