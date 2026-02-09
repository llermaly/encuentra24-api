import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params;

  await db.delete(favorites).where(eq(favorites.adId, adId));

  return NextResponse.json({ success: true });
}
