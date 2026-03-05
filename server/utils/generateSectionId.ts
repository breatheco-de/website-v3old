export function generateSectionId(componentType: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${componentType}-${suffix}`;
}
