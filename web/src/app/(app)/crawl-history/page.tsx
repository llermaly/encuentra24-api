'use client';

import { useUser } from '@stackframe/stack';
import { Suspense } from 'react';
import { CrawlHistory } from '@/components/crawl-history/CrawlHistory';

function CrawlHistoryContent() {
  useUser({ or: 'redirect' });

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Operations</p>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
          Crawl <span className="italic">history</span>
        </h1>
        <p className="text-sm text-stone-500 mt-2">Recent runs, throughput, and errors.</p>
      </div>
      <CrawlHistory />
    </div>
  );
}

export default function CrawlHistoryPage() {
  return (
    <Suspense fallback={
      <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="animate-pulse h-96 rounded-3xl aurora-surface" />
      </div>
    }>
      <CrawlHistoryContent />
    </Suspense>
  );
}
