import { BASE_URL } from '../config.js';

export interface CategoryConfig {
  category: string;
  subcategory: string;
  slug: string;
  label: string;
}

export const SALE_CATEGORIES: CategoryConfig[] = [
  { category: 'sale', subcategory: 'apartamentos', slug: 'bienes-raices-venta-de-propiedades-apartamentos', label: 'Apartamentos (Venta)' },
  { category: 'sale', subcategory: 'casas', slug: 'bienes-raices-venta-de-propiedades-casas', label: 'Casas (Venta)' },
  { category: 'sale', subcategory: 'lotes-y-terrenos', slug: 'bienes-raices-venta-de-propiedades-lotes-y-terrenos', label: 'Lotes y Terrenos (Venta)' },
  { category: 'sale', subcategory: 'casas-y-terrenos-de-playas', slug: 'bienes-raices-venta-de-propiedades-casas-y-terrenos-de-playas', label: 'Casas de Playa (Venta)' },
  { category: 'sale', subcategory: 'fincas', slug: 'bienes-raices-venta-de-propiedades-fincas', label: 'Fincas (Venta)' },
  { category: 'sale', subcategory: 'negocios', slug: 'bienes-raices-venta-de-propiedades-negocios', label: 'Negocios (Venta)' },
  { category: 'sale', subcategory: 'comercios', slug: 'bienes-raices-venta-de-propiedades-comercios', label: 'Comercios (Venta)' },
  { category: 'sale', subcategory: 'oficinas', slug: 'bienes-raices-venta-de-propiedades-oficinas', label: 'Oficinas (Venta)' },
  { category: 'sale', subcategory: 'edificios', slug: 'bienes-raices-venta-de-propiedades-edificios', label: 'Edificios (Venta)' },
  { category: 'sale', subcategory: 'en-islas', slug: 'bienes-raices-venta-de-propiedades-en-islas', label: 'En Islas (Venta)' },
  { category: 'sale', subcategory: 'estacionamientos-sepultura-otros', slug: 'bienes-raices-venta-de-propiedades-estacionamientos-sepultura-otros', label: 'Otros (Venta)' },
];

export const RENTAL_CATEGORIES: CategoryConfig[] = [
  { category: 'rental', subcategory: 'apartamentos', slug: 'bienes-raices-alquiler-apartamentos', label: 'Apartamentos (Alquiler)' },
  { category: 'rental', subcategory: 'apartamentos-amueblados', slug: 'bienes-raices-alquiler-apartamentos-amueblados', label: 'Apts Amueblados (Alquiler)' },
  { category: 'rental', subcategory: 'oficinas', slug: 'bienes-raices-alquiler-alquiler-de-oficinas', label: 'Oficinas (Alquiler)' },
  { category: 'rental', subcategory: 'casas', slug: 'bienes-raices-alquiler-casas', label: 'Casas (Alquiler)' },
  { category: 'rental', subcategory: 'comercios', slug: 'bienes-raices-alquiler-comercios', label: 'Comercios (Alquiler)' },
  { category: 'rental', subcategory: 'cuartos', slug: 'bienes-raices-alquiler-cuartos', label: 'Cuartos (Alquiler)' },
  { category: 'rental', subcategory: 'casas-de-playa', slug: 'bienes-raices-alquiler-casas-de-playa', label: 'Casas de Playa (Alquiler)' },
  { category: 'rental', subcategory: 'casas-en-el-interior', slug: 'bienes-raices-alquiler-casas-en-el-interior', label: 'Casas Interior (Alquiler)' },
  { category: 'rental', subcategory: 'negocios', slug: 'bienes-raices-alquiler-negocios', label: 'Negocios (Alquiler)' },
  { category: 'rental', subcategory: 'lotes-y-terrenos', slug: 'bienes-raices-alquiler-lotes-y-terrenos', label: 'Lotes y Terrenos (Alquiler)' },
  { category: 'rental', subcategory: 'estacionamientos-sepultura-otros', slug: 'bienes-raices-alquiler-estacionamientos-sepultura-otros', label: 'Otros (Alquiler)' },
];

export const OTHER_CATEGORIES: CategoryConfig[] = [
  { category: 'vacation', subcategory: 'alquiler-vacaciones', slug: 'bienes-raices-alquiler-vacaciones', label: 'Alquiler Vacaciones' },
  { category: 'new_project', subcategory: 'proyectos-nuevos', slug: 'bienes-raices-proyectos-nuevos', label: 'Proyectos Nuevos' },
];

export const ALL_CATEGORIES: CategoryConfig[] = [
  ...SALE_CATEGORIES,
  ...RENTAL_CATEGORIES,
  ...OTHER_CATEGORIES,
];

export function findCategory(category?: string, subcategory?: string): CategoryConfig[] {
  let cats = ALL_CATEGORIES;

  if (category) {
    cats = cats.filter((c) => c.category === category);
  }
  if (subcategory) {
    cats = cats.filter((c) => c.subcategory === subcategory);
  }

  return cats;
}

export function buildListUrl(cat: CategoryConfig, regionSlug?: string, page?: number): string {
  let url = `${BASE_URL}/${cat.slug}`;

  if (regionSlug) {
    url += `/${regionSlug}`;
  }

  if (page && page > 1) {
    url += `.${page}`;
  }

  // Sort by recency so incremental crawls find new listings first
  url += '?sort=f_added&dir=desc';

  return url;
}
