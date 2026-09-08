import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local.",
  );
}

/**
 * The publishable key is meant to be public; row level security is what guards
 * the data. This app has no accounts, so every request is the `anon` role.
 */
export const supabase = createClient(url, publishableKey);

/** One row of the expenses table, as Postgres stores it. */
export type ExpenseRow = {
  id: string;
  name: string;
  cost: number | null;
  quantity: number | null;
  elephant: boolean;
  labubu: boolean;
  alpaca: boolean;
  sort_order: number;
};
