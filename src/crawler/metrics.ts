export interface CrawlRuntimeMetrics {
  pagesProcessed: number;
  listingsFound: number;
  listingsNew: number;
  listingsUpdated: number;
  listingsSkipped: number;
  detailsCrawled: number;
  detailsRemoved: number;
  errors: number;
}

const emptyMetrics = (): CrawlRuntimeMetrics => ({
  pagesProcessed: 0,
  listingsFound: 0,
  listingsNew: 0,
  listingsUpdated: 0,
  listingsSkipped: 0,
  detailsCrawled: 0,
  detailsRemoved: 0,
  errors: 0,
});

const metricsByRun = new Map<number, CrawlRuntimeMetrics>();

export function startCrawlMetrics(crawlRunId: number): void {
  metricsByRun.set(crawlRunId, emptyMetrics());
}

export function incrementCrawlMetric(
  crawlRunId: number | undefined,
  key: keyof CrawlRuntimeMetrics,
  amount = 1,
): void {
  if (!crawlRunId) return;

  const metrics = metricsByRun.get(crawlRunId);
  if (!metrics) return;

  metrics[key] += amount;
}

export function addPageMetrics(
  crawlRunId: number,
  values: Pick<CrawlRuntimeMetrics, 'listingsFound' | 'listingsNew' | 'listingsUpdated' | 'listingsSkipped'>,
): void {
  const metrics = metricsByRun.get(crawlRunId);
  if (!metrics) return;

  metrics.pagesProcessed += 1;
  metrics.listingsFound += values.listingsFound;
  metrics.listingsNew += values.listingsNew;
  metrics.listingsUpdated += values.listingsUpdated;
  metrics.listingsSkipped += values.listingsSkipped;
}

export function getCrawlMetrics(crawlRunId: number): CrawlRuntimeMetrics {
  return { ...(metricsByRun.get(crawlRunId) ?? emptyMetrics()) };
}

export function finishCrawlMetrics(crawlRunId: number): CrawlRuntimeMetrics {
  const metrics = getCrawlMetrics(crawlRunId);
  metricsByRun.delete(crawlRunId);
  return metrics;
}
