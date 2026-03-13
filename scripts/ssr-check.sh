#!/bin/bash
set -eo pipefail

echo "Building SSR bundle..."
npx vite build --ssr src/entry-server.tsx --outDir dist/server 2>&1
echo ""

echo "Testing SSR render..."

node --input-type=module -e "
import * as mod from './dist/server/entry-server.js';

const pages = [
  { path: '/en/', slug: 'home', locale: 'en' },
  { path: '/es/', slug: 'home', locale: 'es' },
];

let failures = 0;

for (const { path, slug, locale } of pages) {
  try {
    const html = await mod.render(path, {
      queries: [
        { queryKey: ['/api/content-types'], data: [] },
        { queryKey: ['/api/pages', slug, locale], data: {
          slug,
          title: 'SSR Smoke Test',
          sections: [
            { type: 'hero', content: { heading: 'SSR Smoke Test Heading', sub_heading: 'Verifying server-side rendering' } }
          ]
        }}
      ]
    });

    const hasRootContent = html.includes('data-testid=\"page-') || html.includes('data-section-type=');
    if (html.length < 100) {
      console.error('FAIL ' + path + ': rendered only ' + html.length + ' chars');
      failures++;
    } else if (!hasRootContent) {
      console.error('FAIL ' + path + ': no page content found (' + html.length + ' chars rendered)');
      failures++;
    } else {
      console.log('PASS ' + path + ': ' + html.length + ' chars, page content present');
    }
  } catch (e) {
    console.error('FAIL ' + path + ': ' + e.message);
    failures++;
  }
}

if (failures > 0) {
  console.error('');
  console.error(failures + ' SSR check(s) failed');
  process.exit(1);
} else {
  console.log('');
  console.log('All SSR checks passed');
}
"
