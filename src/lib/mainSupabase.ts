import { createClient } from '@supabase/supabase-js';

// Public browser credentials of MAIN Supabase. This is an anon key, never a
// service-role key; table access remains closed and sites use narrow RPCs only.
const url = 'https://yzvavkllierbwuegfmhd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dmF2a2xsaWVyYnd1ZWdmbWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzcwNjEsImV4cCI6MjA5MTc1MzA2MX0.1dzQVOhjJrlc3AAwGynW-7Xunfj0ZcW04IL42rBWV24';

export const mainSupabaseConfigured = true;
export const mainSupabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
