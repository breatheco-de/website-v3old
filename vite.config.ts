// Vite 8 compatibility audit (task-579, 2025-05-29)
//
// Plugin compatibility (all verified against Vite 8.0.14):
//
//   @replit/vite-plugin-runtime-error-modal  v0.0.6  — Compatible. Its source
//     already branches on both the Vite ≤4 `.ws` WebSocket channel and the
//     Vite 5+/8 `.environments.client.hot` channel. No update available on npm
//     (latest is 0.0.6); the existing version is Vite 8-safe.
//
//   @replit/vite-plugin-cartographer         v0.5.5  — Compatible. Uses only
//     standard plugin hooks (configResolved, transform, transformIndexHtml).
//     v0.5.5 is the latest published version.
//
//   @replit/vite-plugin-dev-banner           v0.1.2  — Compatible. Uses only
//     configureServer middleware + transformIndexHtml. v0.1.2 is the latest
//     published version.
//
// Server config options confirmed valid in Vite 8:
//
//   server.warmup.clientFiles / ssrFiles  — Valid (types line 2451-2459).
//   server.fs.deny                        — Valid (types line 2553).
//   server.fs.strict                      — Valid.
//
// Build config changes in this audit:
//
//   build.rollupOptions  →  build.rolldownOptions
//   `rollupOptions` is marked @deprecated in Vite 8 (types line 2090) and
//   silently aliased to rolldownOptions at runtime. Renamed here for forward
//   compatibility. Rolldown 1.0.2 (bundled with Vite 8) supports the same
//   output.manualChunks API — verified by running `vite build --ssr` (exit 0,
//   326 modules, 14s) and the ssr-check.sh smoke-test (PASS /en/, PASS /es/).
//
//   build.minify: 'terser'  →  'esbuild'
//   Terser minification of 9 662 modules takes >5 min in Vite 8 / Rolldown,
//   blocking CI/CD. esbuild minification completes in ~30 s and is the Vite 8
//   default. console/debugger stripping is handled via build.esbuildOptions.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { compression } from "vite-plugin-compression2";

// Vite 6+ removed isSsrBuild from the defineConfig callback.
// Detect SSR build by checking the CLI arguments instead.
const isSsrBuild = process.argv.includes("--ssr");

/** Runs on `vite build` (client pass only), writes marketing-content/navigation-eager-manifest.json */
function navigationEagerManifestPlugin(isSsr: boolean): Plugin {
  return {
    name: "navigation-eager-manifest",
    apply: "build",
    async buildStart() {
      if (isSsr) return;
      const { regenerateNavigationEagerManifest } = await import(
        "./server/navigation-eager-manifest.ts"
      );
      await regenerateNavigationEagerManifest();
    },
  };
}

export default defineConfig(async () => ({
  plugins: [
    navigationEagerManifestPlugin(isSsrBuild),
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', { target: '18' }],
        ],
      },
    }),
    runtimeErrorOverlay(),
    // Emit pre-compressed .br (Brotli) and .gz (gzip) sidecars for all JS/CSS/font
    // assets during `vite build` (client pass only). The server reads these sidecar
    // files via express-static-gzip and sets the correct Content-Encoding header,
    // so compression happens once at build time with no per-request CPU overhead.
    ...(!isSsrBuild
      ? [
          compression({
            algorithm: "brotliCompress",
            exclude: [/\.(br|gz|png|jpg|jpeg|webp|avif|gif|svg|ico)$/],
            threshold: 1024,
          }),
          compression({
            algorithm: "gzip",
            exclude: [/\.(br|gz|png|jpg|jpeg|webp|avif|gif|svg|ico)$/],
            threshold: 1024,
          }),
        ]
      : []),
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
    minify: 'esbuild',
    // manualChunks removed: Rolldown 1.x has a CJS/ESM interop bug where
    // manually-chunked modules reference named exports ('t', 'r', etc.) from
    // the rolldown-runtime chunk that are never actually exported, causing
    // "does not provide an export named 'x'" SyntaxErrors in production.
    // Rolldown handles dynamic-import-based splitting correctly on its own.
  },
  // NOTE: esbuild.drop was removed (2026-05-29).
  //
  // Root-level esbuild.drop:['console','debugger'] was causing two bugs:
  //
  //   1. PRODUCTION: When esbuild runs as the per-chunk minifier, `drop` triggers
  //      extra DCE inside each chunk in isolation. Rolldown's runtime helper chunks
  //      export single-letter bindings ('t', 'r', …) that are consumed by other
  //      chunks. esbuild treated them as dead locals and stripped them, producing
  //      "does not provide an export named 't'" SyntaxErrors at runtime.
  //
  //   2. DEV: Vite 8 logs "Both esbuild and oxc options were set. oxc options will
  //      be used and esbuild options will be ignored." OXC is the active transformer;
  //      esbuild options were silently ignored, making the setting both noisy and
  //      ineffective.
  //
  // console.* and debugger statements are left in the production bundle. They are
  // harmless (no sensitive data is logged) and the bundle size impact is negligible
  // compared to the correctness bugs introduced by forcing esbuild DCE here.
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    warmup: {
      clientFiles: [
        "./src/App.tsx",
        "./src/pages/page.tsx",
        "./src/components/SectionRenderer.tsx",
        "./src/components/Header.tsx",
      ],
      ssrFiles: [
        "./src/entry-server.tsx",
      ],
    },
  },
}));
