# home-of-the-cheese

apps built for the house

## Develop

```
npm install
npx vercel dev
```

Serves on http://localhost:3000. Use `vercel dev` rather than `npm run dev`: the
receipt scanner needs the function in `api/`, and plain Vite only serves the
frontend.

### Supabase

The expense list lives in a Supabase table, so all three of you see the same
rows. Put the project URL and publishable key in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`VITE_` is the prefix Vite exposes to the browser. That is deliberate here: the
publishable key is meant to be public, and row level security is what guards the
data. Never put a `service_role` key in a `VITE_` variable.

This app has no accounts, so the policies in
`supabase/migrations/` allow the `anon` role to read and write the table. Anyone
with the site URL can therefore edit the list. That is the tradeoff for having
no login; if the site ever goes public, add auth before adding anything private.

Apply the schema with `supabase db push`, or paste the migration into the SQL
editor in the Supabase dashboard.

### Gemini API key

Receipt scanning calls Gemini from `api/parse-receipt.ts`. Put a key in
`.env.local` at the repo root:

```
GEMINI_API_KEY=your-key-here
```

No `VITE_` prefix — that would inline the key into the browser bundle, where
anyone could read it. The key is only ever read server-side.

For deployment, set the same variable in the Vercel project (Settings →
Environment Variables, or `vercel env add GEMINI_API_KEY production`) and
redeploy.
