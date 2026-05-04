'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SaveSearchModalProps {
  filters: Record<string, string>;
  onClose: () => void;
}

export function SaveSearchModal({ filters, onClose }: SaveSearchModalProps) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      onClose();
    },
  });

  const filterEntries = Object.entries(filters);

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="aurora-surface-strong rounded-3xl p-6 w-[440px] max-w-[92vw] shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-amber-100/50 blur-3xl" />

        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">Watch list</p>
          <h2 className="font-serif text-3xl text-stone-900 mt-1.5">Save this <span className="italic">search</span></h2>
          <p className="text-sm text-stone-500 mt-1">We&rsquo;ll let you know when new properties match.</p>

          <div className="mt-5">
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">Name</label>
            <input
              type="text"
              placeholder="e.g. 3-bd casas under $300K"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && saveMutation.mutate()}
              className="aurora-input w-full"
              autoFocus
            />
          </div>

          {filterEntries.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-stone-500 mb-1.5 font-medium">Filters</p>
              <div className="flex flex-wrap gap-1.5">
                {filterEntries.map(([k, v]) => (
                  <span key={k} className="aurora-chip capitalize">
                    {k}: <span className="font-medium text-stone-800 normal-case ml-0.5">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="aurora-pill aurora-pill-ghost">
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
              className="aurora-pill aurora-pill-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
