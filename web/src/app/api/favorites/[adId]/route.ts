import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const user = await requireUser();
  const { adId } = await params;

  await db.delete(favorites).where(
    and(eq(favorites.userId, user.id), eq(favorites.adId, adId))
  );

  return NextResponse.json({ success: true });
}
