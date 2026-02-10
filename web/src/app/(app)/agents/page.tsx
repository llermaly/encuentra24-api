'use client';

import { useUser } from '@stackframe/stack';
import { Suspense } from 'react';
import { AgentLeaderboard } from '@/components/agents/AgentLeaderboard';

function AgentsContent() {
  useUser({ or: 'redirect' });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Agents & Sellers</h1>
      <AgentLeaderboard />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-lg" /></div>}>
      <AgentsContent />
    </Suspense>
  );
}
