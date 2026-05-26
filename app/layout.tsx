import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Logistik Portal',
  description: 'Vrachtbeheer Ecuador & Colombia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
