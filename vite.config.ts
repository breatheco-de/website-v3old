import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/** Runs on `vite build` (client pass only), writes marketing-content/navigation-eager-manifest.json */
function navigationEagerManifestPlugin(isSsrBuild: boolean): Plugin {
  return {
    name: "navigation-eager-manifest",
    apply: "build",
    async buildStart() {
      if (isSsrBuild) return;
      const { regenerateNavigationEagerManifest } = await import(
        "./server/navigation-eager-manifest.ts"
      );
      await regenerateNavigationEagerManifest();
    },
  };
}

export default defineConfig(async ({ isSsrBuild }) => ({
  plugins: [
    navigationEagerManifestPlugin(!!isSsrBuild),
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: isSsrBuild
      ? path.resolve(import.meta.dirname, "dist/server")
      : path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    ssr: isSsrBuild ? "src/entry-server.tsx" : undefined,
    target: isSsrBuild ? "node18" : ["chrome89", "safari15", "firefox89", "edge89"],
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 1,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) {
            return 'codemirror';
          }
          if (id.includes('recharts') || id.includes('victory-vendor')) {
            return 'charts';
          }
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          if (id.includes('@tanstack')) {
            return 'tanstack';
          }
          if (id.includes('react-icons')) {
            return 'icons-react';
          }
          if (id.includes('lucide-react')) {
            return 'icons-lucide';
          }
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }
          if (
            id.includes('node_modules/zod') ||
            id.includes('node_modules/react-hook-form') ||
            id.includes('@hookform/resolvers')
          ) {
            return 'forms';
          }
          if (
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/react-day-picker')
          ) {
            return 'date';
          }
          if (id.includes('node_modules/embla-carousel')) {
            return 'carousel';
          }
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/mdast') ||
            id.includes('node_modules/unified') ||
            id.includes('node_modules/hast') ||
            id.includes('node_modules/rehype') ||
            id.includes('node_modules/vfile')
          ) {
            return 'markdown';
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));
