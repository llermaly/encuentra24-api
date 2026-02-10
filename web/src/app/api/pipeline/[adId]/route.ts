import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pipelineItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {};
  if (body.stage) {
    updates.stage = body.stage;
    updates.movedAt = now;
  }
  if (body.position != null) {
    updates.position = body.position;
  }

  const result = await db
    .update(pipelineItems)
    .set(updates)
    .where(and(eq(pipelineItems.userId, user.id), eq(pipelineItems.adId, adId)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;

  await db.delete(pipelineItems).where(
    and(eq(pipelineItems.userId, user.id), eq(pipelineItems.adId, adId))
  );

  return NextResponse.json({ success: true });
}
