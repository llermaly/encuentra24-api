'use client';

import { useUser } from '@stackframe/stack';
import { Suspense } from 'react';
import { AgentLeaderboard } from '@/components/agents/AgentLeaderboard';

function AgentsContent() {
  useUser({ or: 'redirect' });

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Network</p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Agents <span className="italic">&amp; sellers</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2">Leaderboards by listing volume, value, and average price.</p>
        </div>
      </div>
      <AgentLeaderboard />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="px-6 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="animate-pulse h-96 rounded-3xl aurora-surface" />
      </div>
    }>
      <AgentsContent />
    </Suspense>
  );
}
