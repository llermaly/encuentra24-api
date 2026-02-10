import 'dotenv/config';

export const BASE_URL = 'https://www.encuentra24.com/panama-es';

export const config = {
  database: {
    path: process.env.DATABASE_PATH || './data/encuentra24.db',
    tursoUrl: process.env.TURSO_DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
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
  scraper: {
    headless: process.env.PW_HEADLESS !== 'false',
    delayBetweenMs: Number(process.env.PW_DELAY_MS) || 3000,
    pageTimeoutMs: Number(process.env.PW_TIMEOUT_MS) || 15000,
    contactEmail: process.env.PW_CONTACT_EMAIL || 'juan.perez.panama@gmail.com',
    contactName: process.env.PW_CONTACT_NAME || 'Juan Pérez',
    contactPhone: process.env.PW_CONTACT_PHONE || '60001234',
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
