/**
 * Default Supabase project for ANVIL's optional cloud backend.
 *
 * The anon key is a *publishable* key — it is designed to be shipped to the
 * browser and is safe to commit; row-level security does the real guarding.
 * Users can override both in Settings (e.g. to point at their own project).
 */
export const DEFAULT_SUPABASE_URL = "https://mpezyuvpfewcdlzcsnga.supabase.co";

export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZXp5dXZwZmV3Y2RsemNzbmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTQ5MDQsImV4cCI6MjEwMTMzMDkwNH0.BEil2rEZ6gYhkoe53vpnoIPXzdIayi9gncVfkO3i2wQ";
