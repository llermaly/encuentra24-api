import 'dotenv/config';

export const BASE_URL = 'https://www.encuentra24.com/panama-es';

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://encuentra24:encuentra24@localhost:5433/encuentra24',
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
