import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCategorySlugFromUrl,
  extractSlugFromUrl,
  isRealEstateUrl,
  matchesCategorySlug,
} from './url.js';

test('extractCategorySlugFromUrl returns the listing category segment', () => {
  assert.equal(
    extractCategorySlugFromUrl('https://www.encuentra24.com/panama-es/bienes-raices-venta-de-propiedades-apartamentos/venta-apartamento/32257124'),
    'bienes-raices-venta-de-propiedades-apartamentos',
  );
});

test('extractCategorySlugFromUrl strips pagination suffixes from category pages', () => {
  assert.equal(
    extractCategorySlugFromUrl('https://www.encuentra24.com/panama-es/bienes-raices-alquiler-casas.2?sort=f_added&dir=desc'),
    'bienes-raices-alquiler-casas',
  );
  assert.equal(
    matchesCategorySlug(
      'https://www.encuentra24.com/panama-es/bienes-raices-alquiler-casas.2?sort=f_added&dir=desc',
      'bienes-raices-alquiler-casas',
    ),
    true,
  );
});

test('isRealEstateUrl rejects non real-estate listings', () => {
  assert.equal(
    isRealEstateUrl('https://www.encuentra24.com/panama-es/electronica-computadora-oficina-macintosh-software/apple-imac-24-2023-como-nuevo/32210244'),
    false,
  );
  assert.equal(
    isRealEstateUrl('https://www.encuentra24.com/panama-es/autos-usados/ram-700-bighorn-2024/32210000'),
    false,
  );
});

test('matchesCategorySlug only accepts the expected crawl scope', () => {
  const apartmentUrl = 'https://www.encuentra24.com/panama-es/bienes-raices-venta-de-propiedades-apartamentos/venta-apartamento/32257124';
  const officeUrl = 'https://www.encuentra24.com/panama-es/bienes-raices-venta-de-propiedades-oficinas/oficina-en-area-bancaria/32262611';

  assert.equal(matchesCategorySlug(apartmentUrl, 'bienes-raices-venta-de-propiedades-apartamentos'), true);
  assert.equal(matchesCategorySlug(officeUrl, 'bienes-raices-venta-de-propiedades-apartamentos'), false);
  assert.equal(extractSlugFromUrl(apartmentUrl), 'venta-apartamento');
});
