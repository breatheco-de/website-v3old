const TAG_RE = /^<\/?[a-zA-Z][^>]*>/;

export function hasHtmlTags(text: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(text);
}

export function getTextLength(html: string): number {
  let count = 0;
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end !== -1) {
        i = end + 1;
        continue;
      }
    }
    if (html[i] === "&") {
      const semi = html.indexOf(";", i);
      if (semi !== -1 && semi - i < 10) {
        count++;
        i = semi + 1;
        continue;
      }
    }
    count++;
    i++;
  }
  return count;
}

export function sliceHtml(html: string, visibleChars: number): string {
  let result = "";
  let textCount = 0;
  let i = 0;
  const openTags: string[] = [];

  while (i < html.length && textCount < visibleChars) {
    if (html[i] === "<") {
      const match = html.slice(i).match(TAG_RE);
      if (match) {
        const tag = match[0];
        result += tag;
        if (tag.startsWith("</")) {
          openTags.pop();
        } else if (!tag.endsWith("/>")) {
          const tagName = tag.match(/^<([a-zA-Z]+)/)?.[1];
          if (tagName) openTags.push(tagName);
        }
        i += tag.length;
        continue;
      }
    }

    if (html[i] === "&") {
      const semi = html.indexOf(";", i);
      if (semi !== -1 && semi - i < 10) {
        result += html.slice(i, semi + 1);
        textCount++;
        i = semi + 1;
        continue;
      }
    }

    result += html[i];
    textCount++;
    i++;
  }

  while (openTags.length > 0) {
    const tag = openTags.pop();
    result += `</${tag}>`;
  }

  return result;
}
