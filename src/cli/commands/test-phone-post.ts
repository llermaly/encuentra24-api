import 'dotenv/config';
import { CheerioCrawler, Configuration } from 'crawlee';

Configuration.getGlobalConfig().set('persistStorage', false);

const listingUuid = process.argv[2] || '31675687';
const modalUrl = `https://www.encuentra24.com/panama-es/cnad/contactmodal?showphone=1&uuid=${listingUuid}`;

const crawler = new CheerioCrawler({
  maxConcurrency: 1,
  additionalMimeTypes: ['application/json'],
  requestHandler: async ({ $, request, crawler: c, body, response }) => {
    const label = request.userData.label;

    if (label === 'post') {
      console.log('\n=== Form POST Response ===');
      console.log('Status:', response.statusCode);
      console.log('Content-Type:', response.headers['content-type']);

      const bodyStr = typeof body === 'string' ? body : body.toString();
      console.log('Body length:', bodyStr.length);

      // Try JSON parse
      try {
        const json = JSON.parse(bodyStr);
        console.log('JSON response:', JSON.stringify(json, null, 2));
        if (json.content) {
          console.log('\n*** PHONE NUMBER FOUND:', json.content, '***');
        }
      } catch {
        // HTML response - check for phone patterns
        console.log('Not JSON, checking HTML...');
        const phones = bodyStr.match(/tel:\+?\d+|wa\.me\/\d+|"content"\s*:\s*"[^"]+"/g);
        if (phones) console.log('Phone patterns:', phones);
        // Show first 500 chars
        console.log('First 500 chars:', bodyStr.substring(0, 500));
      }
      return;
    }

    // Step 1: Parse modal
    console.log('=== Contact Modal ===');
    const form = $('form.lead-form-popup');
    const csrfToken = form.find('[name="cnmessage[_csrf_token]"]').val();
    const formAction = form.attr('action');
    const formId = form.attr('id');

    const showPhoneBtn = form.find('.show-phone');
    const contactData = showPhoneBtn.attr('data-contact') || '';

    console.log('CSRF:', csrfToken);
    console.log('Form action:', formAction);
    console.log('Contact data:', contactData.substring(0, 80));

    // Also find the cnmessage_z hidden field
    const zField = form.find('[id*="cnmessage_z"], [name*="_z"]');
    console.log('Z field found:', zField.length, 'name:', zField.attr('name'), 'id:', zField.attr('id'));

    // List ALL hidden inputs
    console.log('\nAll hidden inputs:');
    form.find('input[type="hidden"]').each((_, el) => {
      console.log(`  name=${$(el).attr('name')} id=${$(el).attr('id')} value=${($(el).attr('value') || '').substring(0, 50)}`);
    });

    if (!formAction || !csrfToken) return;

    const postUrl = `https://www.encuentra24.com${formAction}`;

    // Build form data with ALL fields including contactdata and fingerprint
    const formData = new URLSearchParams();
    formData.append('cnmessage[_csrf_token]', csrfToken as string);
    formData.append('cnmessage[fromemail]', 'test@example.com');
    formData.append('cnmessage[name]', 'Test User');
    formData.append('cnmessage[phone][countrycode]', '00507');
    formData.append('cnmessage[phone][phonenumber]', '60001234');
    formData.append('cnmessage[phone][combined]', '+50760001234');
    formData.append('cnmessage[captcha]', '');
    formData.append('cnmessage[id]', '');

    // The critical z field (fingerprint) - try with a fake value
    formData.append('cnmessage[z]', 'abc123def456');

    formData.append('d3', '1');
    formData.append('class', 'lead-form-popup');
    formData.append('extra_data', '');
    formData.append('action', 'see-phone');
    formData.append('exclude_mandatory_email', '1');
    formData.append('contactdata', contactData);

    console.log('\nPosting with action=see-phone and contactdata...');

    await c.addRequests([{
      url: `${postUrl}?_t=1`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/html, */*',
        'Referer': `https://www.encuentra24.com/panama-es/bienes-raices-venta-de-propiedades-casas/${listingUuid}`,
      },
      payload: formData.toString(),
      userData: { label: 'post' },
      uniqueKey: 'post-seephone',
    }]);
  },
  failedRequestHandler: async ({ request }, error) => {
    console.log(`FAILED: ${request.url.substring(0, 80)}`, (error as Error).message.substring(0, 200));
  },
});

crawler.run([{ url: modalUrl }]).catch(console.error);
