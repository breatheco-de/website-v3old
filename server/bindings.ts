import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { escapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import { markFileAsModified } from "./sync-state";
import { contentIndex, MARKETING_CONTENT_PATH } from "./content-index";

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yaml.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}

const BINDINGS_FILE = path.join(MARKETING_CONTENT_PATH, "section-bindings.json");

const EXCLUDED_PROPERTIES = new Set([
  "paddingY",
  "paddingTop",
  "paddingBottom",
  "marginY",
  "marginTop",
  "marginBottom",
  "padding",
  "margin",
  "background",
  "background_color",
  "backgroundColor",
  "bg_color",
  "visibility",
  "show_on",
  "item_overrides",
  "section_id",
  "anchor",
  "css_class",
  "cssClass",
  "customClass",
]);

export interface BindingMember {
  contentType: string;
  slug: string;
  sectionIndex: number;
}

export interface BindingGroup {
  id: string;
  name?: string;
  component: string;
  locale: string;
  members: BindingMember[];
  createdAt: string;
  updatedAt?: string;
}

interface BindingsData {
  groups: BindingGroup[];
}

function generateId(): string {
  return `bind_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class BindingManager {
  private data: BindingsData = { groups: [] };
  private memberIndex: Map<string, string> = new Map();
  private loaded = false;

  private memberKey(contentType: string, slug: string, sectionIndex: number): string {
    return `${contentType}:${slug}:${sectionIndex}`;
  }

  private rebuildIndex(): void {
    this.memberIndex.clear();
    for (const group of this.data.groups) {
      for (const member of group.members) {
        const key = this.memberKey(member.contentType, member.slug, member.sectionIndex);
        this.memberIndex.set(key, group.id);
      }
    }
  }

  load(): void {
    try {
      if (fs.existsSync(BINDINGS_FILE)) {
        const raw = fs.readFileSync(BINDINGS_FILE, "utf-8");
        this.data = JSON.parse(raw);
        if (!Array.isArray(this.data.groups)) {
          this.data = { groups: [] };
        }
      } else {
        this.data = { groups: [] };
      }
    } catch (error) {
      console.error("[BindingManager] Error loading bindings:", error);
      this.data = { groups: [] };
    }
    this.rebuildIndex();
    this.loaded = true;
    console.log(`[BindingManager] Loaded ${this.data.groups.length} binding groups`);
  }

  private ensureLoaded(): void {
    if (!this.loaded) this.load();
  }

  private save(): void {
    try {
      const dir = path.dirname(BINDINGS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(BINDINGS_FILE, JSON.stringify(this.data, null, 2), "utf-8");
      markFileAsModified("marketing-content/section-bindings.json");
    } catch (error) {
      console.error("[BindingManager] Error saving bindings:", error);
    }
  }

  getAll(): BindingGroup[] {
    this.ensureLoaded();
    return [...this.data.groups];
  }

  getGroupById(groupId: string): BindingGroup | undefined {
    this.ensureLoaded();
    return this.data.groups.find(g => g.id === groupId);
  }

  findGroupForSection(contentType: string, slug: string, sectionIndex: number): BindingGroup | undefined {
    this.ensureLoaded();
    const key = this.memberKey(contentType, slug, sectionIndex);
    const groupId = this.memberIndex.get(key);
    if (!groupId) return undefined;
    return this.data.groups.find(g => g.id === groupId);
  }

  findGroupsForPage(contentType: string, slug: string): BindingGroup[] {
    this.ensureLoaded();
    return this.data.groups.filter(g =>
      g.members.some(m => m.contentType === contentType && m.slug === slug)
    );
  }

  private validateMemberComponent(member: BindingMember, expectedComponent: string, locale: string): void {
    const { data } = this.loadPageContent(member.contentType, member.slug, locale);
    if (!data) {
      throw new Error(`Cannot access content for ${member.contentType}/${member.slug}`);
    }
    const sections = data.sections as Record<string, unknown>[];
    if (!Array.isArray(sections) || member.sectionIndex >= sections.length) {
      throw new Error(`Section index ${member.sectionIndex} out of range for ${member.contentType}/${member.slug}`);
    }
    const section = sections[member.sectionIndex];
    if (!section || (section as Record<string, unknown>).type !== expectedComponent) {
      throw new Error(
        `Section at ${member.contentType}/${member.slug}[${member.sectionIndex}] is type "${(section as Record<string, unknown>)?.type}", expected "${expectedComponent}"`
      );
    }
  }

  createGroup(
    component: string,
    locale: string,
    members: BindingMember[],
    options?: { name?: string; sourceIndex?: number }
  ): BindingGroup {
    this.ensureLoaded();

    if (members.length < 2) {
      throw new Error("A binding group requires at least 2 members");
    }

    for (const member of members) {
      this.validateMemberComponent(member, component, locale);
      const key = this.memberKey(member.contentType, member.slug, member.sectionIndex);
      const existingGroupId = this.memberIndex.get(key);
      if (existingGroupId) {
        throw new Error(
          `Section ${member.contentType}/${member.slug}[${member.sectionIndex}] is already in binding group ${existingGroupId}`
        );
      }
    }

    const group: BindingGroup = {
      id: generateId(),
      component,
      locale,
      members,
      createdAt: new Date().toISOString(),
    };
    if (options?.name) {
      group.name = options.name;
    }

    this.data.groups.push(group);
    this.rebuildIndex();
    this.save();

    const srcIdx = options?.sourceIndex ?? 0;
    const sourceMember = members[srcIdx] || members[0];
    this.propagateFromMember(group, sourceMember);

    return group;
  }

  renameGroup(groupId: string, name: string): BindingGroup {
    this.ensureLoaded();
    const group = this.data.groups.find(g => g.id === groupId);
    if (!group) throw new Error(`Binding group ${groupId} not found`);
    group.name = name || undefined;
    group.updatedAt = new Date().toISOString();
    this.save();
    return group;
  }

  private propagateFromMember(group: BindingGroup, sourceMember: BindingMember): void {
    const { data: sourceData } = this.loadPageContent(sourceMember.contentType, sourceMember.slug, group.locale);
    if (!sourceData) return;
    const sourceSections = sourceData.sections as Record<string, unknown>[];
    if (!Array.isArray(sourceSections) || sourceMember.sectionIndex >= sourceSections.length) return;
    const sourceSection = sourceSections[sourceMember.sectionIndex] as Record<string, unknown>;
    if (!sourceSection) return;

    const siblings = group.members.filter(
      m => !(m.contentType === sourceMember.contentType && m.slug === sourceMember.slug && m.sectionIndex === sourceMember.sectionIndex)
    );

    for (const sibling of siblings) {
      try {
        const { data: siblingData, filePath } = this.loadPageContent(sibling.contentType, sibling.slug, group.locale);
        if (!siblingData) continue;
        const sections = siblingData.sections as Record<string, unknown>[];
        if (!Array.isArray(sections) || sibling.sectionIndex >= sections.length) continue;
        const existingSectionObj = sections[sibling.sectionIndex] as Record<string, unknown>;
        if (!existingSectionObj) continue;

        sections[sibling.sectionIndex] = this.mergeContentIntoSection(existingSectionObj, sourceSection);
        const updatedYaml = safeYamlDump(siblingData, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
          forceQuotes: false,
        });
        fs.writeFileSync(filePath, updatedYaml, "utf-8");
        markFileAsModified(filePath);
      } catch (err) {
        console.error(`[BindingManager] Error propagating to ${sibling.contentType}/${sibling.slug}:`, err);
      }
    }
  }

  addMember(groupId: string, member: BindingMember): BindingGroup {
    this.ensureLoaded();
    const group = this.data.groups.find(g => g.id === groupId);
    if (!group) throw new Error(`Binding group ${groupId} not found`);

    this.validateMemberComponent(member, group.component, group.locale);

    const key = this.memberKey(member.contentType, member.slug, member.sectionIndex);
    const existingGroupId = this.memberIndex.get(key);
    if (existingGroupId) {
      throw new Error(
        `Section ${member.contentType}/${member.slug}[${member.sectionIndex}] is already in binding group ${existingGroupId}`
      );
    }

    const alreadyMember = group.members.some(
      m => m.contentType === member.contentType && m.slug === member.slug && m.sectionIndex === member.sectionIndex
    );
    if (alreadyMember) {
      throw new Error("Section is already a member of this group");
    }

    group.members.push(member);
    group.updatedAt = new Date().toISOString();
    this.rebuildIndex();
    this.save();

    const existingMember = group.members.find(
      m => !(m.contentType === member.contentType && m.slug === member.slug && m.sectionIndex === member.sectionIndex)
    );
    if (existingMember) {
      this.propagateFromMember(
        { ...group, members: [existingMember, member] },
        existingMember
      );
    }

    return group;
  }

  removeMember(groupId: string, contentType: string, slug: string, sectionIndex: number): BindingGroup | null {
    this.ensureLoaded();
    const group = this.data.groups.find(g => g.id === groupId);
    if (!group) throw new Error(`Binding group ${groupId} not found`);

    group.members = group.members.filter(
      m => !(m.contentType === contentType && m.slug === slug && m.sectionIndex === sectionIndex)
    );

    if (group.members.length < 2) {
      this.data.groups = this.data.groups.filter(g => g.id !== groupId);
      this.rebuildIndex();
      this.save();
      return null;
    }

    group.updatedAt = new Date().toISOString();
    this.rebuildIndex();
    this.save();
    return group;
  }

  deleteGroup(groupId: string): void {
    this.ensureLoaded();
    this.data.groups = this.data.groups.filter(g => g.id !== groupId);
    this.rebuildIndex();
    this.save();
  }

  updateIndicesForPage(
    contentType: string,
    slug: string,
    oldIndex: number,
    newIndex: number
  ): void {
    this.ensureLoaded();
    let changed = false;

    for (const group of this.data.groups) {
      for (const member of group.members) {
        if (member.contentType === contentType && member.slug === slug) {
          if (member.sectionIndex === oldIndex) {
            member.sectionIndex = newIndex;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.rebuildIndex();
      this.save();
    }
  }

  handleSectionRemoved(contentType: string, slug: string, removedIndex: number): void {
    this.ensureLoaded();
    let changed = false;

    for (const group of this.data.groups) {
      const memberToRemove = group.members.find(
        m => m.contentType === contentType && m.slug === slug && m.sectionIndex === removedIndex
      );

      if (memberToRemove) {
        group.members = group.members.filter(m => m !== memberToRemove);
        changed = true;
      }

      for (const member of group.members) {
        if (member.contentType === contentType && member.slug === slug && member.sectionIndex > removedIndex) {
          member.sectionIndex--;
          changed = true;
        }
      }
    }

    if (changed) {
      this.data.groups = this.data.groups.filter(g => g.members.length >= 2);
      this.rebuildIndex();
      this.save();
    }
  }

  handleSectionAdded(contentType: string, slug: string, addedIndex: number): void {
    this.ensureLoaded();
    let changed = false;

    for (const group of this.data.groups) {
      for (const member of group.members) {
        if (member.contentType === contentType && member.slug === slug && member.sectionIndex >= addedIndex) {
          member.sectionIndex++;
          changed = true;
        }
      }
    }

    if (changed) {
      this.rebuildIndex();
      this.save();
    }
  }

  private loadPageContent(contentType: string, slug: string, locale: string): { data: Record<string, unknown> | null; filePath: string } {
    const { data, filePath } = contentIndex.loadLocaleData(contentType, slug, locale);
    return { data, filePath };
  }

  private stripExcludedProperties(section: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(section)) {
      if (!EXCLUDED_PROPERTIES.has(key)) {
        result[key] = value;
      }
    }
    return result;
  }

  private mergeContentIntoSection(
    existingSection: Record<string, unknown>,
    sourceSection: Record<string, unknown>
  ): Record<string, unknown> {
    const contentOnly = this.stripExcludedProperties(sourceSection);

    const preserved: Record<string, unknown> = {};
    EXCLUDED_PROPERTIES.forEach(key => {
      if (key in existingSection) {
        preserved[key] = existingSection[key];
      }
    });

    return { ...contentOnly, ...preserved };
  }

  propagateUpdate(
    sourceContentType: string,
    sourceSlug: string,
    sectionIndex: number,
    updatedSection: Record<string, unknown>,
    author?: string
  ): { success: boolean; updatedFiles: string[]; errors: string[] } {
    this.ensureLoaded();

    const group = this.findGroupForSection(sourceContentType, sourceSlug, sectionIndex);
    if (!group) return { success: true, updatedFiles: [], errors: [] };

    const siblings = group.members.filter(
      m => !(m.contentType === sourceContentType && m.slug === sourceSlug && m.sectionIndex === sectionIndex)
    );

    if (siblings.length === 0) return { success: true, updatedFiles: [], errors: [] };

    const updatedFiles: string[] = [];
    const errors: string[] = [];

    for (const sibling of siblings) {
      try {
        const locale = group.locale;
        const { data: siblingData, filePath } = this.loadPageContent(sibling.contentType, sibling.slug, locale);
        if (!siblingData) {
          errors.push(`Could not load content for ${sibling.contentType}/${sibling.slug}`);
          continue;
        }

        const sections = siblingData.sections as Record<string, unknown>[];
        if (!Array.isArray(sections) || sibling.sectionIndex >= sections.length) {
          errors.push(`Section index ${sibling.sectionIndex} out of range for ${sibling.contentType}/${sibling.slug}`);
          continue;
        }

        const existingSection = sections[sibling.sectionIndex];
        if (typeof existingSection !== "object" || existingSection === null) {
          errors.push(`Invalid section at index ${sibling.sectionIndex} for ${sibling.contentType}/${sibling.slug}`);
          continue;
        }

        const existingSectionObj = existingSection as Record<string, unknown>;
        if (existingSectionObj.type !== updatedSection.type) {
          errors.push(
            `Component mismatch at ${sibling.contentType}/${sibling.slug}[${sibling.sectionIndex}]: ` +
            `expected ${updatedSection.type}, found ${existingSectionObj.type}`
          );
          continue;
        }

        sections[sibling.sectionIndex] = this.mergeContentIntoSection(existingSectionObj, updatedSection);

        const updatedYaml = safeYamlDump(siblingData, {
          lineWidth: -1,
          noRefs: true,
          quotingType: '"',
          forceQuotes: false,
        });

        fs.writeFileSync(filePath, updatedYaml, "utf-8");
        markFileAsModified(filePath, author);
        updatedFiles.push(`${sibling.contentType}/${sibling.slug}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error propagating to ${sibling.contentType}/${sibling.slug}: ${msg}`);
      }
    }

    return { success: errors.length === 0, updatedFiles, errors };
  }

  cleanupStaleReferences(): number {
    this.ensureLoaded();
    let removed = 0;

    for (const group of this.data.groups) {
      const validMembers = group.members.filter(member => {
        try {
          const { data } = this.loadPageContent(member.contentType, member.slug, group.locale);
          if (!data) return false;
          const sections = data.sections as unknown[];
          if (!Array.isArray(sections) || member.sectionIndex >= sections.length) return false;
          const section = sections[member.sectionIndex] as Record<string, unknown>;
          return section && section.type === group.component;
        } catch {
          return false;
        }
      });

      removed += group.members.length - validMembers.length;
      group.members = validMembers;
    }

    const beforeCount = this.data.groups.length;
    this.data.groups = this.data.groups.filter(g => g.members.length >= 2);
    removed += beforeCount - this.data.groups.length;

    if (removed > 0) {
      this.rebuildIndex();
      this.save();
      console.log(`[BindingManager] Cleaned up ${removed} stale references`);
    }

    return removed;
  }
}

export const bindingManager = new BindingManager();
