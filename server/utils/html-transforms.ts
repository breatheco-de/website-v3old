export function applyNonBlockingCss(html: string): string {
  return html.replace(
    /<link rel="stylesheet"([^>]*href="\/assets\/[^"]+\.css"[^>]*)>/g,
    (_, attrs) =>
      `<link rel="preload"${attrs} as="style" onload="this.onload=null;this.rel='stylesheet'">` +
      `<noscript><link rel="stylesheet" ${attrs}></noscript>`
  );
}

export function applyEntryModulePreload(html: string): string {
  return html.replace(
    /(<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>)/g,
    (match, _full, src) =>
      `<link rel="modulepreload" crossorigin href="${src}">${match}`
  );
}
