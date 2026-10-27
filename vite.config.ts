import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Same plugin stack Malaya gets from @lovable.dev/vite-tanstack-config, spelled out.
export default defineConfig(async ({ command }) => {
  const plugins = [tailwindcss(), tsConfigPaths({ projects: ["./tsconfig.json"] }), tanstackStart(), viteReact()];
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: "vercel" }));
  }
  return { server: { port: 3000 }, plugins };
});
