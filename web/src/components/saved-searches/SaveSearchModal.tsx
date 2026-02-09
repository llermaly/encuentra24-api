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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Save Search</h2>
        <input
          type="text"
          placeholder="Search name..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && saveMutation.mutate()}
          className="w-full px-3 py-2 text-sm border rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <p className="text-xs text-gray-500 mb-4">
          {Object.entries(filters).map(([k, v]) => `${k}: ${v}`).join(', ')}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
