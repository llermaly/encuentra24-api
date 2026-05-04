'use client';

import { Suspense } from 'react';
import { Fraunces } from 'next/font/google';
import { useUser } from '@stackframe/stack';
import { Sidebar } from '@/components/layout/Sidebar';
import './aurora-skin.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = useUser({ or: 'redirect' });

  if (!user) return null;

  return (
    <div className={`${fraunces.variable} aurora-skin flex h-screen overflow-hidden`}>
      <Sidebar />
      <main className="aurora-bg flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className={`${fraunces.variable} aurora-skin aurora-bg flex items-center justify-center h-screen`}>
        <div className="font-serif italic text-stone-500 text-lg">Loading…</div>
      </div>
    }>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </Suspense>
  );
}
