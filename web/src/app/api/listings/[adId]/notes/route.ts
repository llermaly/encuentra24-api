import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { propertyNotes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;

  const notes = await db
    .select()
    .from(propertyNotes)
    .where(and(eq(propertyNotes.adId, adId), eq(propertyNotes.userId, user.id)))
    .orderBy(desc(propertyNotes.createdAt));

  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;
  const body = await request.json();

  const result = await db.insert(propertyNotes).values({
    userId: user.id,
    adId,
    type: body.type || 'note',
    content: body.content,
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}
