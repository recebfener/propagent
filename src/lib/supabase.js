import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Supabase env vars eksik: VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY gerekli.");
}

export const supabase = createClient(url, key);
