import 'dotenv/config';

export const BASE_URL = 'https://www.encuentra24.com/panama-es';

export const config = {
  database: {
    path: process.env.DATABASE_PATH || './data/encuentra24.db',
  },
  crawler: {
    maxConcurrency: Number(process.env.MAX_CONCURRENCY) || 3,
    maxRequestsPerMinute: Number(process.env.MAX_REQUESTS_PER_MINUTE) || 40,
    sameDomainDelaySecs: Number(process.env.SAME_DOMAIN_DELAY_SECS) || 2,
    maxRequestRetries: 3,
    defaultMaxPages: 5,
    listingsPerPage: 30,
    betweenCategoryDelaySecs: 5,
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
