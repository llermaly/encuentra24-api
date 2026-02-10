import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { savedSearches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name) updates.name = body.name;
  if (body.filters) updates.filters = JSON.stringify(body.filters);
  if (body.lastCheckedAt) updates.lastCheckedAt = body.lastCheckedAt;
  if (body.newMatchCount != null) updates.newMatchCount = body.newMatchCount;

  const result = await db
    .update(savedSearches)
    .set(updates)
    .where(and(eq(savedSearches.id, Number(id)), eq(savedSearches.userId, user.id)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  await db.delete(savedSearches).where(
    and(eq(savedSearches.id, Number(id)), eq(savedSearches.userId, user.id))
  );

  return NextResponse.json({ success: true });
}
