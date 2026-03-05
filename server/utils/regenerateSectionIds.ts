import { generateSectionId } from "./generateSectionId";

function collectSectionIds(objs: Record<string, unknown>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const obj of objs) {
    const sections = obj.sections;
    if (!Array.isArray(sections)) continue;
    for (const section of sections) {
      if (section && typeof section === "object") {
        const s = section as Record<string, unknown>;
        if (typeof s.section_id === "string" && s.section_id) {
          const newId = generateSectionId((s.type as string) || "section");
          map.set(s.section_id, newId);
        }
      }
    }
  }
  return map;
}

function replaceIdRefs(value: unknown, map: Map<string, string>): unknown {
  if (typeof value === "string") {
    const hash = value.match(/^#(.+)$/);
    if (hash && map.has(hash[1])) {
      return `#${map.get(hash[1])}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => replaceIdRefs(v, map));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = replaceIdRefs(v, map);
    }
    return result;
  }
  return value;
}

function applyNewIds(obj: Record<string, unknown>, map: Map<string, string>): Record<string, unknown> {
  const sections = obj.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (section && typeof section === "object") {
        const s = section as Record<string, unknown>;
        if (typeof s.section_id === "string" && map.has(s.section_id)) {
          s.section_id = map.get(s.section_id)!;
        }
      }
    }
  }
  return replaceIdRefs(obj, map) as Record<string, unknown>;
}

export function regenerateSectionIds(
  objs: Record<string, unknown>[],
): { objs: Record<string, unknown>[]; idMap: Map<string, string> } {
  const idMap = collectSectionIds(objs);
  const updated = objs.map((obj) => applyNewIds(obj, idMap));
  return { objs: updated, idMap };
}
