'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@stackframe/stack';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/constants';
import { formatPrice } from '@/lib/formatters';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';

interface PipelineItem {
  adId: string;
  stage: string;
  position: number;
  movedAt: string;
  createdAt: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaSqm: number | null;
  thumbnail: string | null;
  url: string | null;
}

const STAGE_GRADIENTS: Record<PipelineStage, string> = {
  discovered: 'from-stone-200 to-stone-300',
  shortlisted: 'from-emerald-100 to-emerald-200',
  contacted: 'from-amber-100 to-amber-200',
  visited: 'from-stone-200 to-amber-100',
  negotiating: 'from-emerald-200 to-stone-300',
  won: 'from-emerald-300 to-stone-700',
  passed: 'from-stone-300 to-stone-500',
};

const STAGE_DOT: Record<PipelineStage, string> = {
  discovered: '#a8a29e',
  shortlisted: '#84a982',
  contacted: '#c9b896',
  visited: '#94a3b8',
  negotiating: '#6b8e6b',
  won: '#1a1a1a',
  passed: '#78716c',
};

function KanbanCard({ item }: { item: PipelineItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.adId,
    data: { stage: item.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="aurora-surface rounded-2xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow"
    >
      {item.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnail} alt="" className="w-full h-24 object-cover rounded-xl mb-2" />
      ) : (
        <div className="w-full h-24 rounded-xl mb-2 bg-gradient-to-br from-stone-100 to-stone-200" />
      )}
      <p className="font-serif text-base text-stone-900">{formatPrice(item.price, item.currency || 'USD')}</p>
      <p className="text-xs text-stone-700 truncate mt-0.5">{item.title || '—'}</p>
      <p className="text-[10px] text-stone-500 truncate">{item.location || '—'}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-2 text-[10px] text-stone-500">
          {item.bedrooms != null && <span>{item.bedrooms}bd</span>}
          {item.bathrooms != null && <span>{item.bathrooms}ba</span>}
          {item.builtAreaSqm != null && <span>{Math.round(item.builtAreaSqm)}m²</span>}
        </div>
        <Link
          href={`/listings/${item.adId}`}
          className="text-[11px] text-stone-600 hover:text-stone-900 underline-offset-2 hover:underline"
          onClick={e => e.stopPropagation()}
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, items }: { stage: PipelineStage; items: PipelineItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between px-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: STAGE_DOT[stage] }} />
          <h3 className="font-serif text-base text-stone-900">
            {PIPELINE_STAGE_LABELS[stage]}
          </h3>
        </div>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/70 text-stone-600 tabular-nums"
        >
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`relative flex-1 rounded-2xl min-h-[400px] transition-all overflow-hidden
          ${isOver ? 'ring-2 ring-emerald-700/50 ring-offset-2 ring-offset-transparent' : ''}
        `}
        style={{
          background: 'rgba(255,255,255,0.35)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.7)',
        }}
      >
        <div
          className={`absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-br ${STAGE_GRADIENTS[stage]} opacity-40 blur-2xl`}
        />
        <div className="relative p-2.5 space-y-2.5">
          <SortableContext items={items.map(i => i.adId)} strategy={verticalListSortingStrategy}>
            {items.map(item => (
              <KanbanCard key={item.adId} item={item} />
            ))}
          </SortableContext>
          {items.length === 0 && (
            <div className="text-center py-8 text-xs text-stone-400 italic">
              Drop here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  useUser({ or: 'redirect' });
  const queryClient = useQueryClient();
  const [activeItem, setActiveItem] = useState<PipelineItem | null>(null);

  const { data: items = [], isLoading } = useQuery<PipelineItem[]>({
    queryKey: ['pipeline'],
    queryFn: () => fetch('/api/pipeline').then(r => r.json()),
  });

  const moveItem = useMutation({
    mutationFn: async ({ adId, stage }: { adId: string; stage: string }) => {
      await fetch(`/api/pipeline/${adId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
    },
    onMutate: async ({ adId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline'] });
      const previous = queryClient.getQueryData<PipelineItem[]>(['pipeline']);
      queryClient.setQueryData<PipelineItem[]>(['pipeline'], old =>
        old?.map(item => item.adId === adId ? { ...item, stage } : item) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pipeline'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const item = items.find(i => i.adId === event.active.id);
    setActiveItem(item || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const adId = active.id as string;
    const overStage = PIPELINE_STAGES.includes(over.id as typeof PIPELINE_STAGES[number])
      ? (over.id as string)
      : (items.find(i => i.adId === over.id)?.stage ?? null);

    if (!overStage) return;

    const currentItem = items.find(i => i.adId === adId);
    if (currentItem && currentItem.stage !== overStage) {
      moveItem.mutate({ adId, stage: overStage });
    }
  }

  const grouped = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = items.filter(i => i.stage === stage);
    return acc;
  }, {} as Record<PipelineStage, PipelineItem[]>);

  const totalValue = items
    .filter(i => i.price != null && i.stage !== 'passed')
    .reduce((s, i) => s + (i.price || 0), 0);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1700px] mx-auto">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 font-medium">
            Workflow
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-stone-900 mt-1.5">
            Pipeline
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            Drag properties through the stages — from discovery to deal.
          </p>
        </div>
        {items.length > 0 && (
          <div className="aurora-surface rounded-2xl px-5 py-3 flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">In flow</p>
              <p className="font-serif text-2xl text-stone-900 tabular-nums">{items.length}</p>
            </div>
            <div className="w-px h-9 bg-stone-200" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">Pipeline value</p>
              <p className="font-serif text-2xl text-stone-900 tabular-nums">
                ${totalValue >= 1_000_000 ? `${(totalValue / 1_000_000).toFixed(1)}M` : totalValue >= 1_000 ? `${(totalValue / 1_000).toFixed(0)}K` : totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-72 h-96 rounded-2xl aurora-surface animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-3xl aurora-surface">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, #ecf3ec, #ebe4cd)' }}
          >
            <svg className="w-7 h-7 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h12M3 17h6" />
            </svg>
          </div>
          <p className="font-serif text-2xl text-stone-900">Nothing in your pipeline yet</p>
          <p className="text-sm text-stone-500 mt-1">
            Add a property from the{' '}
            <Link href="/listings" className="text-stone-800 underline-offset-4 hover:underline">listing detail page</Link>{' '}
            to get started.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2">
            {PIPELINE_STAGES.map(stage => (
              <KanbanColumn key={stage} stage={stage} items={grouped[stage] || []} />
            ))}
          </div>
          <DragOverlay>
            {activeItem && (
              <div className="aurora-surface rounded-2xl p-2.5 w-72 shadow-2xl rotate-2">
                <p className="font-serif text-base text-stone-900">{formatPrice(activeItem.price)}</p>
                <p className="text-xs text-stone-700 truncate">{activeItem.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
