import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib")
    }
  },
  optimizeDeps: {
    exclude: ["@tauri-apps/api", "@tauri-apps/api/core"]
  },
  server: {
    host: true,
<<<<<<< HEAD
    port: 5173,
    strictPort: true,
    allowedHosts: "all"
=======
    port: 1420,
    strictPort: true,
    allowedHosts: [".app.github.dev"]
>>>>>>> cc4323a (updating db)
  }
});
