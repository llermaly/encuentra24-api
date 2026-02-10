import 'dotenv/config';
import { CheerioCrawler, Configuration, HttpCrawler } from 'crawlee';
import * as cheerio from 'cheerio';

Configuration.getGlobalConfig().set('persistStorage', false);

const url = process.argv[2] || 'https://www.encuentra24.com/panama-es/bienes-raices-venta-de-propiedades-casas/casa-en-venta-en-panama-norte-urb-casa-real-cerca-de-villa-zaita/31675687';

const crawler = new CheerioCrawler({
  maxConcurrency: 1,
  requestHandler: async ({ $, request, crawler: c }) => {
    console.log('=== All wa.me links ===');
    $('a[href*="wa.me"]').each((_, el) => {
      const href = $(el).attr('href');
      const cls = $(el).attr('class') || '';
      const parent = $(el).parent().attr('class') || '';
      const text = $(el).text().trim().substring(0, 50);
      console.log(`  ${href} | class: ${cls} | parent: ${parent} | text: ${text}`);
    });

    console.log('\n=== All tel: links ===');
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href');
      const cls = $(el).attr('class') || '';
      const text = $(el).text().trim().substring(0, 50);
      console.log(`  ${href} | class: ${cls} | text: ${text}`);
    });

    console.log('\n=== Contactar buttons & modals ===');
    $('[data-href*="contact"], [data-href*="modal"], [data-target*="contact"], [data-target*="modal"]').each((_, el) => {
      console.log(`  tag=${$(el).prop('tagName')} | data-href=${$(el).attr('data-href')} | data-target=${$(el).attr('data-target')} | class=${$(el).attr('class')} | text=${$(el).text().trim().substring(0, 80)}`);
    });

    // Look for any data attributes with user IDs
    console.log('\n=== Elements with touserid or user data ===');
    $('[data-touserid], [data-userid], [data-user-id], [data-seller]').each((_, el) => {
      console.log(`  `, el.attribs);
    });

    // Look for loopaData or RetailRocket phone data
    console.log('\n=== Scripts with phone/whatsapp/contact data ===');
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      if (content.includes('phone') || content.includes('whatsapp') || content.includes('contactPhone') || content.includes('sellerPhone')) {
        const match = content.match(/(phone|whatsapp|contactPhone|sellerPhone)[^;]{0,200}/gi);
        if (match) {
          match.forEach(m => console.log(`  ${m.substring(0, 200)}`));
        }
      }
    });

    // Look for JSON-LD with seller info
    console.log('\n=== JSON-LD seller data ===');
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        if (json.seller || json.offeredBy || json.provider) {
          console.log('  ', JSON.stringify(json.seller || json.offeredBy || json.provider, null, 2));
        }
      } catch {}
    });

    // Find the contact modal URL
    const modalEl = $('[data-href*="usermodal"], [data-href*="contact"]');
    if (modalEl.length) {
      const modalHref = modalEl.attr('data-href');
      console.log(`\n=== Trying modal endpoint: ${modalHref} ===`);
      // Queue modal URL to fetch
      if (modalHref) {
        const fullUrl = modalHref.startsWith('http') ? modalHref : `https://www.encuentra24.com${modalHref}`;
        await c.addRequests([{ url: fullUrl, userData: { isModal: true } }]);
      }
    }

    // Also check if there's a contact API endpoint in inline scripts
    console.log('\n=== Contact API endpoints in scripts ===');
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      const apiMatches = content.match(/contact\/[a-z]+[^"'\s]{0,100}/gi);
      if (apiMatches) {
        apiMatches.forEach(m => console.log(`  ${m}`));
      }
    });

    // Look for RetailRocket data
    console.log('\n=== RetailRocket seller data ===');
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      if (content.includes('retailrocket') || content.includes('RetailRocket')) {
        const sellerMatch = content.match(/(seller|agent|phone|contact)[^;]{0,300}/gi);
        if (sellerMatch) {
          sellerMatch.forEach(m => console.log(`  ${m.substring(0, 200)}`));
        }
      }
    });

    // Print full contact section HTML
    console.log('\n=== Full contact section HTML ===');
    const contactSelectors = ['.d3-ad-contact', '.d3-property-contact', '.d3-ad-tile__contact'];
    for (const sel of contactSelectors) {
      const el = $(sel);
      if (el.length) {
        console.log(`  ${sel} (${el.length} elements):`);
        console.log(el.html()?.substring(0, 2000));
      }
    }
  },
});

crawler.run([{ url }]).catch(console.error);
