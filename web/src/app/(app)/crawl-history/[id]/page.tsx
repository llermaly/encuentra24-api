'use client';

import { useUser } from '@stackframe/stack';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { CrawlRunDetail } from '@/components/crawl-history/CrawlRunDetail';

function Content() {
  useUser({ or: 'redirect' });
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <CrawlRunDetail runId={Number(id)} />
    </div>
  );
}

export default function CrawlRunDetailPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-lg" /></div>}>
      <Content />
    </Suspense>
  );
}
