import { NextRequest } from 'next/server';
import { handleNotificationCron } from '@/app/api/cron/notifications/_shared';

export async function GET(request: NextRequest) {
  return handleNotificationCron(request, 'weekly');
}
