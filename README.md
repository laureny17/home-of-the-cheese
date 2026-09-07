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
