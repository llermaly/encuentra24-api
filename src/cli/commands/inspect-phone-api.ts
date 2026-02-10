import 'dotenv/config';
import { CheerioCrawler, Configuration } from 'crawlee';

Configuration.getGlobalConfig().set('persistStorage', false);

const listingUuid = process.argv[2] || '31675687';

// Try various endpoints and parameter combos
const endpoints = [
  `https://www.encuentra24.com/panama-es/cnad/GetContactPhone?uuid=${listingUuid}`,
  `https://www.encuentra24.com/panama-es/cnad/GetContactPhone?adid=${listingUuid}`,
  `https://www.encuentra24.com/panama-es/cnad/GetContactPhone`,
  `https://www.encuentra24.com/panama-es/cnad/contactmodal?showphone=1&uuid=${listingUuid}`,
];

const crawler = new CheerioCrawler({
  maxConcurrency: 1,
  additionalMimeTypes: ['application/json'],
  requestHandler: async ({ $, request, body }) => {
    console.log(`\n=== ${request.url} ===`);
    console.log('Status: OK');

    // Try parsing as JSON
    const bodyStr = typeof body === 'string' ? body : body.toString();
    try {
      const json = JSON.parse(bodyStr);
      console.log('JSON response:', JSON.stringify(json, null, 2));
    } catch {
      // HTML response - look for phone data
      console.log('HTML length:', bodyStr.length);

      // Find phone/whatsapp in the response
      const phoneMatches = bodyStr.match(/(phone|whatsapp|tel:|wa\.me|número|telefono)[^<"]{0,100}/gi);
      if (phoneMatches) {
        console.log('Phone-related content:');
        phoneMatches.forEach(m => console.log(`  ${m.substring(0, 150)}`));
      }

      // Find form fields
      if ($ && typeof $.html === 'function') {
        $('input, button, a[href*="tel"], a[href*="wa.me"]').each((_, el) => {
          const tag = $(el).prop('tagName');
          const type = $(el).attr('type') || '';
          const name = $(el).attr('name') || '';
          const value = $(el).attr('value') || '';
          const href = $(el).attr('href') || '';
          const cls = $(el).attr('class') || '';
          console.log(`  <${tag}> type=${type} name=${name} value=${value} href=${href} class=${cls}`);
        });

        // Show phone button
        const showPhone = $('.show-phone');
        if (showPhone.length) {
          console.log('Show phone button:', showPhone.html()?.substring(0, 200));
          console.log('Show phone attrs:', showPhone.attr('data-url'), showPhone.attr('data-phone'));
        }

        // Full HTML truncated
        console.log('\nFull HTML (first 3000 chars):');
        console.log($.html().substring(0, 3000));
      }
    }
  },
  failedRequestHandler: async ({ request }, error) => {
    console.log(`\n=== FAILED: ${request.url} ===`);
    console.log('Error:', (error as Error).message);
  },
});

crawler.run(endpoints.map(url => ({ url }))).catch(console.error);
