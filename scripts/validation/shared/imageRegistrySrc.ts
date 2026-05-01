/** Remote or non-repo-relative src: do not use path.join(cwd, src) + fs.existsSync. */
export function isNonLocalFilesystemSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("//") ||
    s.startsWith("gs://")
  );
}

export interface RegistryImageEntryLike {
  src?: string;
}

/** Map registry `src` strings (and leading-slash variants for local paths) → image id. First entry wins on duplicates. */
export function buildRegistrySrcToIdMap(
  images: Record<string, RegistryImageEntryLike>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [id, entry] of Object.entries(images)) {
    const raw = entry?.src;
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    const add = (key: string) => {
      if (!map.has(key)) map.set(key, id);
    };
    add(s);
    if (!isNonLocalFilesystemSrc(s)) {
      add(s.startsWith("/") ? s.slice(1) : s);
      add(s.startsWith("/") ? s : `/${s}`);
    }
  }
  return map;
}

/**
 * Resolve a content reference to a registry id: direct key match, or reverse lookup when the ref equals some entry.src (e.g. URL in image_id).
 */
export function resolveRegistryReference(
  ref: string,
  images: Record<string, RegistryImageEntryLike>,
  srcToId: Map<string, string>,
): string | null {
  const r = ref.trim();
  if (!r) return null;
  if (Object.prototype.hasOwnProperty.call(images, r)) return r;
  if (srcToId.has(r)) return srcToId.get(r)!;
  if (!isNonLocalFilesystemSrc(r)) {
    const withSlash = r.startsWith("/") ? r : `/${r}`;
    const noSlash = r.startsWith("/") ? r.slice(1) : r;
    if (srcToId.has(withSlash)) return srcToId.get(withSlash)!;
    if (srcToId.has(noSlash)) return srcToId.get(noSlash)!;
  }
  return null;
}
