'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/constants';
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

function KanbanCard({ item }: { item: PipelineItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.adId,
    data: { stage: item.stage },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-sm"
    >
      {item.thumbnail && (
        <img src={item.thumbnail} alt="" className="w-full h-20 object-cover rounded mb-1.5" />
      )}
      <p className="text-sm font-bold text-gray-900">{formatPrice(item.price, item.currency || 'USD')}</p>
      <p className="text-xs text-gray-700 truncate">{item.title}</p>
      <p className="text-xs text-gray-400 truncate">{item.location}</p>
      <div className="flex gap-2 text-xs text-gray-500 mt-1">
        {item.bedrooms != null && <span>{item.bedrooms}bd</span>}
        {item.bathrooms != null && <span>{item.bathrooms}ba</span>}
      </div>
      <Link
        href={`/listings/${item.adId}`}
        className="text-xs text-blue-600 hover:underline mt-1 block"
        onClick={e => e.stopPropagation()}
      >
        Details
      </Link>
    </div>
  );
}

function KanbanColumn({ stage, items }: { stage: string; items: PipelineItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center justify-between px-2 py-1.5 mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] ?? stage}
        </h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 rounded-lg min-h-[200px] transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 border-2 border-transparent'
        }`}
      >
        <SortableContext items={items.map(i => i.adId)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <KanbanCard key={item.adId} item={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function PipelinePage() {
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
  }, {} as Record<string, PipelineItem[]>);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Pipeline</h1>
        <div className="animate-pulse flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-64 h-64 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Pipeline</h1>
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No properties in the pipeline yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add properties from the listing detail page.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map(stage => (
              <KanbanColumn key={stage} stage={stage} items={grouped[stage] || []} />
            ))}
          </div>
          <DragOverlay>
            {activeItem && (
              <div className="bg-white border rounded-lg p-2 shadow-lg w-64 opacity-90">
                <p className="text-sm font-bold">{formatPrice(activeItem.price)}</p>
                <p className="text-xs truncate">{activeItem.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
