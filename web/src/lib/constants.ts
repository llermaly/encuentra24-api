export const PIPELINE_STAGES = [
  'discovered',
  'shortlisted',
  'contacted',
  'visited',
  'negotiating',
  'won',
  'passed',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  discovered: 'Discovered',
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  visited: 'Visited',
  negotiating: 'Negotiating',
  won: 'Won',
  passed: 'Passed',
};

export const NOTE_TYPES = [
  'note',
  'contact_attempt',
  'visit',
  'offer',
  'general',
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  note: 'Note',
  contact_attempt: 'Contact Attempt',
  visit: 'Visit',
  offer: 'Offer',
  general: 'General',
};

export const SORT_OPTIONS = [
  { value: 'published_desc', label: 'Newest Published' },
  { value: 'date_desc', label: 'Recently Seen' },
  { value: 'first_seen_desc', label: 'Recently Added' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'area_desc', label: 'Largest Area' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'sale', label: 'For Sale' },
  { value: 'rental', label: 'For Rent' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'new_project', label: 'New Projects' },
] as const;

export const SUBCATEGORY_OPTIONS = [
  { value: 'casas', label: 'Houses' },
  { value: 'apartamentos', label: 'Apartments' },
  { value: 'lotes-y-terrenos', label: 'Land' },
  { value: 'comercios', label: 'Commercial' },
  { value: 'oficinas', label: 'Offices' },
  { value: 'edificios', label: 'Buildings' },
  { value: 'fincas', label: 'Farms' },
  { value: 'casas-y-terrenos-de-playas', label: 'Beach Properties' },
  { value: 'negocios', label: 'Businesses' },
  { value: 'cuartos', label: 'Rooms' },
  { value: 'apartamentos-amueblados', label: 'Furnished Apts' },
] as const;

export const DEFAULT_PAGE_SIZE = 24;
