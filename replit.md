# The AI Reskilling Platform

### Overview
The AI Reskilling Platform is a minimalistic Learning Management System (LMS) web application focused on marketing. Its main goal is to offer an intuitive interface for career path selection and skill acquisition in AI education. The platform aims to provide accessible, high-quality education globally through a scalable, content-driven architecture, with future integration planned for the 4geeks Breathecode API for authentication, profile management, and content delivery.

### User Preferences
- Icon library: @tabler/icons-react (NEVER lucide-react)
- Design approach: Marketing-focused landing page
- Card border radius: 0.8rem throughout the platform
- Testing: NEVER use playwright for testing - it takes too much time. User prefers manual verification only.
- Font system: Noto Color Emoji for consistent emoji rendering across all operating systems
- Colors: ONLY semantic tokens - NEVER use hardcoded colors like `bg-blue-500`, `text-red-600`, or arbitrary hex values. Only use semantic classes: `bg-primary`, `text-foreground`, `bg-muted`, etc.
- Video: ALWAYS use the `UniversalVideo` component (`client/src/components/UniversalVideo.tsx`) for ALL video content. NEVER use raw `<video>` tags, `<iframe>` embeds, or other video libraries directly.
- Images: ALWAYS use the `UniversalImage` component (`client/src/components/UniversalImage.tsx`) for ALL image content. Reference images by ID from the centralized registry (`marketing-content/image-registry.json`). NEVER use hardcoded image paths in components.
- Image Storage: New images go in `marketing-content/images/` (served at `/marketing-content/images/`). Legacy images remain in `attached_assets/` (served at `/attached_assets/`). The `attached_assets/` folder also contains conversation screenshots which are excluded from the registry scanner and gitignored.
- URL Routing: Use `/en/` prefix for English pages and `/es/` prefix for Spanish pages. NEVER use `/us/` - this is incorrect. Example: `/en/geekforce-career-support` (correct), `/us/geekforce-career-support` (wrong).

### System Architecture
The platform utilizes React with TypeScript, Vite, Tailwind CSS, shadcn UI, wouter, and TanStack Query for the frontend, and Express for the backend.

**Key Architectural Decisions & Features:**
-   **Design System**: Features a clean, card-based layout with a semantic color system, Lato typography, and `@tabler/icons-react`.
-   **Content Management System (CMS)**: A YAML-based system for marketing teams to manage content for career programs, landing pages, location pages, and template pages. Content is stored in `marketing-content/` and rendered dynamically by a `SectionRenderer` component.
-   **ContentIndex Singleton**: An ORM-like utility (`server/content-index.ts`) that indexes all `marketing-content/` on startup, providing lookup methods and auto-refreshing. Content types and their URL patterns are defined in `marketing-content/content-types.yml` (single source of truth). The `buildUrl(type, slug, locale)` method generates locale-correct URLs using pattern substitution. Locale-specific slugs (e.g., `ia-para-profesionales`) are automatically resolved to base folder slugs (e.g., `ai-for-professionals`) via `resolveBaseSlug()`.
-   **Template Pages System**: A single generic page template (`client/src/pages/page.tsx`) renders all YAML-based pages, supporting `/en/:slug` and `/es/:slug` routes.
-   **Internationalization (i18n)**: Supports English and Spanish using `react-i18next`, with browser language detection and a language switcher.
-   **SEO & Performance**: Includes comprehensive meta tags, Open Graph, Twitter Cards, Schema.org JSON-LD, `robots.txt`, dynamic sitemaps, route-level code splitting, self-hosted WOFF2 fonts, server-side Gzip compression, React component memoization, and native lazy loading.
-   **Schema.org System**: Centralized in `marketing-content/schema-org.yml` for structured data, with a `useSchemaOrg` hook for JSON-LD injection.
-   **URL Redirects System**: Handles 301 redirects defined in YAML meta properties, with a validation script to prevent conflicts.
-   **Versioned Component Registry**: A filesystem-based registry at `marketing-content/component-registry/` stores versioned component schemas and examples, with an API at `/api/component-registry`. Integration requires schema import, `SectionRenderer` case, and YAML-to-schema matching. Components can define `field-editors.ts` for specialized input types.
-   **Session Management System**: A hybrid client-side system providing IP-based geolocation, nearest campus calculation, UTM tracking, and language detection, using a Web Worker and `SessionContext`.
-   **A/B Testing Experiment System**: A cookie-based system for content variants, managed by `ExperimentManager.ts`, supporting various targeting variables, debug endpoints, and a comprehensive `Experiment Editor`.
-   **UniversalVideo Component**: Mandatory component (`client/src/components/UniversalVideo.tsx`) for all video content, handling local videos and lazy-loading `react-player` for external sources.
-   **UniversalImage Component**: Mandatory component (`client/src/components/UniversalImage.tsx`) for all image content, referencing `image-registry.json`.
-   **Inline Editing System**: A capability-based system for human editors and AI agents, allowing direct content modification on the site via `EditModeContext`, `EditableSection` wrappers, `SectionEditorPanel`, and server-side APIs.
-   **Theme Configuration System**: A centralized `marketing-content/theme.json` defines allowed colors for backgrounds, accents, and text, used by editors to save resolved CSS values directly to YAML.
-   **Validation System**: A modular framework (`scripts/validation/`) for both preventive (API calls) and reactive (CLI batch scanning) validation. It supports various validators for redirects, meta, schema, sitemap, components, and theme compliance. New validators can be easily added and exposed via API.
-   **GitHub Content Sync**: Allows content edits made via the inline editor to be committed back to a GitHub repository, enabling synchronization between development and production content. Configurable via environment variables.
-   **Conversion Tracking System**: A centralized module (`client/src/lib/tracking.ts`) for type-safe analytics and conversion tracking via Google Tag Manager (GTM), supporting pre-defined conversion names. Email addresses are SHA-256 hashed for privacy before sending to the dataLayer.
-   **Content Diagnostics System**: A self-service diagnostics page at `/private/diagnostics` with two tabs: Global Health (runs all validators with summary stats, filter/search, expandable issue cards) and Page Analysis (per-page deep dive with SEO/Schema/Content scores, meta analysis, JSON-LD preview, image integrity, translation status). Powered by 4 new validators: `seo-depth`, `schema-completeness`, `images`, `content-quality`. API: `GET /api/diagnostics/pages`, `GET /api/diagnostics/page?url=X`. Accessible via the debug bubble.
-   **SSR Schema Injection**: Server-side injection of Schema.org JSON-LD into HTML responses (`server/ssr-schema.ts`). For every page route, the Express server resolves the page's YAML content (merging `_common.yml` + locale file), extracts the `schema` property, calls `getMergedSchemas()` to build JSON-LD, and auto-detects `type: faq` sections to generate `FAQPage` structured data. All JSON-LD is injected before `</head>` in the raw HTML — no JavaScript execution needed for search engines to see it. The client-side `useSchemaOrg` hook remains as a fallback for SPA navigation.
-   **Media Module**: A pluggable storage provider system (`server/media/`) supporting local filesystem and cloud storage (Google Cloud Storage). Uses strategy pattern with auto-detection from URL prefix. The `Media` facade singleton (`server/media/index.ts`) resolves providers via `owns()` and is configured via env vars (`MEDIA_DEFAULT_PROVIDER`, `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GCS_KEY_FILENAME`). Extensible for AWS S3, Azure Blob, Cloudflare R2.
-   **MediaGallery Singleton**: Consolidates all image registry operations (`server/media-gallery.ts`): load, scan, apply, register, unregister, bulk unregister, usage check, and cross-provider migration. Replaces scattered logic in `routes.ts`, `image-registry.ts`, and `image-registry-scanner.ts`. Includes a 24-hour existence cache for remote URL checks. API endpoints at `/api/image-registry/*` delegate to this singleton. Migration endpoint at `/api/image-registry/migrate` supports dry-run. CLI migration script at `scripts/migrate-to-cloud.ts`.

### External Dependencies
-   **4geeks Breathecode API**: For user authentication, profile management, and educational content delivery.
-   **@tabler/icons-react**: Icon library.
-   **react-i18next**: Internationalization library.
-   **Vite**: Frontend build tool.
-   **Tailwind CSS**: CSS framework.
-   **shadcn UI**: UI component library.
-   **wouter**: Routing library.
-   **TanStack Query**: Data fetching and state management.
-   **Express**: Backend server framework.
-   **Google Tag Manager**: For analytics and conversion tracking.
-   **@google-cloud/storage**: Google Cloud Storage SDK for cloud media storage provider.