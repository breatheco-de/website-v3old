# The AI Reskilling Platform

### Overview
The AI Reskilling Platform is a minimalistic Learning Management System (LMS) web application focused on marketing. Its primary purpose is to offer an intuitive interface for career path selection and skill acquisition in AI education. The platform aims to provide accessible, high-quality education globally through a scalable, content-driven architecture, with future integration planned for the 4geeks Breathecode API.

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
-   **Content Management System (CMS)**: A YAML-based system for marketing teams to manage content, rendered dynamically by a `SectionRenderer` component. Content is indexed by an ORM-like utility (`server/content-index.ts`) on startup.
-   **Template Pages System**: A single generic page template (`client/src/pages/page.tsx`) renders all YAML-based pages, supporting `/en/:slug` and `/es/:slug` routes.
-   **Internationalization (i18n)**: Supports English and Spanish using `react-i18next`, with browser language detection and a language switcher.
-   **SEO & Performance**: Includes comprehensive meta tags, Open Graph, Twitter Cards, Schema.org JSON-LD, `robots.txt`, dynamic sitemaps, route-level code splitting, self-hosted WOFF2 fonts, server-side Gzip compression, React component memoization, and native lazy loading. Schema.org JSON-LD is injected server-side.
-   **URL Redirects System**: Handles 301 redirects defined in YAML meta properties and `custom-redirects.yml`, with validation and support for regex patterns.
-   **Versioned Component Registry**: A filesystem-based registry at `marketing-content/component-registry/` stores versioned component schemas and examples, with Zod schemas defined within each component's registry folder.
-   **Session Management System**: A hybrid client-side system providing IP-based geolocation, nearest campus calculation, UTM tracking, and language detection.
-   **A/B Testing Experiment System**: A cookie-based system for content variants, supporting various targeting variables and a comprehensive `Experiment Editor`.
-   **UniversalVideo Component**: Mandatory component (`client/src/components/UniversalVideo.tsx`) for all video content.
-   **UniversalImage Component**: Mandatory component (`client/src/components/UniversalImage.tsx`) for all image content, referencing `image-registry.json`.
-   **Inline Editing System**: A capability-based system for human editors and AI agents, allowing direct content modification on the site via `EditModeContext` and server-side APIs.
-   **Theme Configuration System**: A centralized `marketing-content/theme.json` defines allowed colors for backgrounds, accents, and text.
-   **Validation System**: A modular framework (`scripts/validation/`) for both preventive (API calls) and reactive (CLI batch scanning) validation across redirects, meta, schema, sitemap, components, and theme compliance.
-   **GitHub Content Sync**: Allows content edits made via the inline editor to be committed back to a GitHub repository.
-   **Conversion Tracking System**: A centralized module (`client/src/lib/tracking.ts`) for type-safe analytics and conversion tracking via Google Tag Manager (GTM).
-   **Content Diagnostics System**: A self-service diagnostics page at `/private/diagnostics` providing global health and per-page analysis.
-   **Media Module**: A pluggable storage provider system (`server/media/`) supporting local filesystem and cloud storage (Google Cloud Storage) using a strategy pattern.
-   **MediaGallery Singleton**: Consolidates all image registry operations and API endpoints (`server/media-gallery.ts`), including upload and migration functionalities.
-   **FAQ Per-Item Location Visibility**: FAQ sections support `item_overrides` for hiding specific FAQ items based on the visitor's location.
-   **Section Bindings System**: `BindingManager` singleton (`server/bindings.ts`) synchronizes content between sections of the same component type and locale across different pages, with CRUD operations, immediate content propagation on bind, optional group naming, and automatic propagation on edit.
-   **Blog System**: Pluggable blog integration using a provider/adapter pattern, fetching posts from configurable data sources, caching them, and providing API routes for management. Frontend pages for blog listing and individual posts are supported with SSR meta tags.

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