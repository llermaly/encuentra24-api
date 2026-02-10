'use client';

import { Suspense } from 'react';
import { useUser } from '@stackframe/stack';
import { Sidebar } from '@/components/layout/Sidebar';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = useUser({ or: 'redirect' });

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </Suspense>
  );
}
