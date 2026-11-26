import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Practice Room — Tuner, Metronome & Drums",
        short_name: "Practice Room",
        description: "Tuner, metronome, drum rudiments and groove practice.",
        theme_color: "#14161a",
        background_color: "#14161a",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
