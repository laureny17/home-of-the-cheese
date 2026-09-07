import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly. Vite otherwise listens on [::1] only, which
    // `vercel dev` can't reach when it proxies to 127.0.0.1, and every
    // request through it hangs.
    host: "127.0.0.1",
  },
});
