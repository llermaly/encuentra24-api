import { NextResponse } from 'next/server';
import { stackServerApp } from "@/stack";

export async function requireUser() {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}
