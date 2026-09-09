// Hand-written database types, matched to supabase/migrations/*.sql.
//
// Regenerate from the live project once it exists (keeps this exact shape):
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
// Until then this file is the source of truth for the lib layer.

export type BlogStatus = 'draft' | 'scheduled' | 'published';
export type Locale = 'en' | 'fr' | 'es' | 'it';
export type BookingStatus = 'new' | 'contacted' | 'confirmed' | 'done' | 'cancelled';
export type MessageStatus = 'new' | 'contacted' | 'done' | 'cancelled';

export type BlogPostRow = {

  id: string;
  slug: string;
  locale: Locale;
  status: BlogStatus;
  title: string;
  excerpt: string;
  body_md: string;
  cover_image: string | null;
  cover_alt: string;
  tags: string[];
  author_name: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  translation_of: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogSettingsRow = {

  id: boolean;
  posts_per_page: number;
  title_en: string | null; title_fr: string | null; title_es: string | null; title_it: string | null;
  intro_en: string | null; intro_fr: string | null; intro_es: string | null; intro_it: string | null;
  updated_at: string;
}

export type PageOverrideRow = {

  id: string;
  page_key: string;
  field_key: string;
  locale: Locale;
  value: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type AdminProfileRow = {

  user_id: string;
  email: string | null;
  is_owner: boolean;
  sections: string[];
  active: boolean;
  created_at: string;
}

export type BookingRow = {

  id: string;
  created_at: string;
  status: BookingStatus;
  from_loc: string | null;
  to_loc: string | null;
  trip_type: string | null;
  pax: number | null;
  vehicle: string | null;
  trip_date: string | null;
  trip_time: string | null;
  return_date: string | null;
  return_time: string | null;
  flight_number: string | null;
  train_number: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  child_seats: Record<string, unknown>;
  extra_stop: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  price_estimate: number | null;
  locale: string | null;
  source: string | null;
  notes: string;
  raw: Record<string, unknown>;
}

export type ContactMessageRow = {

  id: string;
  created_at: string;
  status: MessageStatus;
  first_name: string | null;
  email: string | null;
  language: string | null;
  message: string | null;
  notes: string;
  raw: Record<string, unknown>;
}

// Shape required by @supabase/supabase-js v2's typed client: each table needs
// Row / Insert / Update / Relationships, and the empty maps must be
// `{ [_ in never]: never }` (not `Record<string, never>`) or the whole schema
// is rejected and every query resolves to `never`.
type TableDef<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      blog_posts: TableDef<BlogPostRow>;
      blog_settings: TableDef<BlogSettingsRow>;
      page_overrides: TableDef<PageOverrideRow>;
      admin_profiles: TableDef<AdminProfileRow>;
      bookings: TableDef<BookingRow>;
      contact_messages: TableDef<ContactMessageRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      has_section: { Args: { s: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
