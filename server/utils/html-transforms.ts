export function applyNonBlockingCss(html: string): string {
  return html.replace(
    /<link rel="stylesheet" (href="\/assets\/[^"]+\.css"[^>]*)>/g,
    (_, attrs) =>
      `<link rel="preload" ${attrs} as="style" onload="this.onload=null;this.rel='stylesheet'">` +
      `<noscript><link rel="stylesheet" ${attrs}></noscript>`
  );
}
