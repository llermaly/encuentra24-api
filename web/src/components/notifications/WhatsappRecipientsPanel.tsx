'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface NotificationRecipient {
  id: number;
  channel: string;
  destination: string;
  label: string | null;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RecipientsResponse {
  recipients: NotificationRecipient[];
  evoConfigured: boolean;
  setupRequired?: boolean;
  error?: string;
}

function displayPhone(destination: string) {
  return `+${destination}`;
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        checked
          ? 'bg-stone-950 text-white'
          : 'bg-white/60 text-stone-600 hover:text-stone-950'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          checked ? 'bg-emerald-300' : 'bg-stone-300'
        }`}
      />
      {label}
    </button>
  );
}

export function WhatsappRecipientsPanel() {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<RecipientsResponse>({
    queryKey: ['notifications', 'recipients'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/recipients');
      if (!response.ok) throw new Error('Unable to load WhatsApp recipients');
      return response.json();
    },
  });

  const recipients = useMemo(() => data?.recipients ?? [], [data?.recipients]);
  const enabledCounts = useMemo(() => ({
    daily: recipients.filter(recipient => recipient.dailyEnabled).length,
    weekly: recipients.filter(recipient => recipient.weeklyEnabled).length,
  }), [recipients]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          label,
          dailyEnabled: true,
          weeklyEnabled: true,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to add WhatsApp recipient');
      }
      return response.json();
    },
    onSuccess: () => {
      setPhoneNumber('');
      setLabel('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['notifications', 'recipients'] });
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Unable to add WhatsApp recipient');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, unknown> }) => {
      const response = await fetch(`/api/notifications/recipients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to update WhatsApp recipient');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'recipients'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/notifications/recipients/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to remove WhatsApp recipient');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'recipients'] });
    },
  });

  function submitRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    addMutation.mutate();
  }

  return (
    <section className="rounded-3xl aurora-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-stone-500 font-medium">WhatsApp</p>
          <h2 className="font-serif text-2xl text-stone-950 mt-1">Recipients</h2>
        </div>
        <span className={data?.evoConfigured ? 'aurora-chip aurora-chip-mint' : 'aurora-chip aurora-chip-warn'}>
          {data?.evoConfigured ? 'Evo ready' : 'Evo missing'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-2xl bg-white/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-500">Daily enabled</p>
          <p className="font-serif text-2xl text-stone-950 mt-1">{enabledCounts.daily}</p>
        </div>
        <div className="rounded-2xl bg-white/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-500">Weekly enabled</p>
          <p className="font-serif text-2xl text-stone-950 mt-1">{enabledCounts.weekly}</p>
        </div>
      </div>

      <form onSubmit={submitRecipient} className="mt-5 space-y-3">
        <div>
          <label className="text-xs font-medium text-stone-600" htmlFor="whatsapp-number">Phone number</label>
          <input
            id="whatsapp-number"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+56934261197"
            className="aurora-input mt-1 w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-stone-600" htmlFor="whatsapp-label">Label</label>
          <input
            id="whatsapp-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Personal"
            className="aurora-input mt-1 w-full"
          />
        </div>
        {(formError || error || data?.setupRequired) && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {formError || data?.error || (error as Error)?.message}
          </p>
        )}
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="aurora-pill aurora-pill-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addMutation.isPending ? 'Adding...' : 'Add recipient'}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {isLoading && (
          <p className="text-sm text-stone-500">Loading recipients...</p>
        )}
        {!isLoading && recipients.length === 0 && (
          <p className="text-sm text-stone-500">No WhatsApp recipients yet.</p>
        )}
        {recipients.map(recipient => (
          <div key={recipient.id} className="rounded-2xl bg-white/55 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-950 truncate">
                  {recipient.label || 'WhatsApp recipient'}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">{displayPhone(recipient.destination)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeMutation.mutate(recipient.id)}
                disabled={removeMutation.isPending}
                className="text-xs font-medium text-stone-500 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Toggle
                label="Daily"
                checked={recipient.dailyEnabled}
                disabled={updateMutation.isPending}
                onChange={() => updateMutation.mutate({
                  id: recipient.id,
                  patch: { dailyEnabled: !recipient.dailyEnabled },
                })}
              />
              <Toggle
                label="Weekly"
                checked={recipient.weeklyEnabled}
                disabled={updateMutation.isPending}
                onChange={() => updateMutation.mutate({
                  id: recipient.id,
                  patch: { weeklyEnabled: !recipient.weeklyEnabled },
                })}
              />
            </div>
          </div>
        ))}
        {(updateMutation.error || removeMutation.error) && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {((updateMutation.error || removeMutation.error) as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}
