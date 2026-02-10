'use client';

import { useUser } from '@stackframe/stack';
import { Suspense } from 'react';
import { CrawlHistory } from '@/components/crawl-history/CrawlHistory';

function CrawlHistoryContent() {
  useUser({ or: 'redirect' });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Crawl History</h1>
      <CrawlHistory />
    </div>
  );
}

export default function CrawlHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-lg" /></div>}>
      <CrawlHistoryContent />
    </Suspense>
  );
}
