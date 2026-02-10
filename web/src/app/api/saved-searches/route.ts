import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { savedSearches } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id))
    .orderBy(desc(savedSearches.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();
  const now = new Date().toISOString();

  const result = await db.insert(savedSearches).values({
    userId: user.id,
    name: body.name,
    filters: JSON.stringify(body.filters),
    lastCheckedAt: now,
    newMatchCount: 0,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}
