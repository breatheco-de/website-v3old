import type { Icon } from "@tabler/icons-react";

export type MenuView = "main" | "components" | "sitemap" | "experiments";

export const STORAGE_KEY = "debug-bubble-menu-view";

export interface SitemapUrl {
  loc: string;
  label: string;
}

export interface RedirectItem {
  from: string;
  to: string;
  type: string;
}

export interface ExperimentVariant {
  slug: string;
  version: number;
  allocation: number;
}

export interface ExperimentConfig {
  slug: string;
  status: "planned" | "active" | "paused" | "winner" | "archived";
  description?: string;
  variants: ExperimentVariant[];
  targeting?: Record<string, unknown>;
  max_visitors?: number;
  stats?: Record<string, number>;
}

export interface ExperimentsResponse {
  experiments: ExperimentConfig[];
  hasExperimentsFile: boolean;
  filePath: string;
}

export interface ContentInfo {
  type: string | null;
  slug: string | null;
  label: string;
  locale: string | null;
  variant: string | null;
  version: number | null;
}

export interface VariantInfo {
  filename: string;
  name: string;
  variantSlug: string;
  version: number | null;
  locale: string;
  displayName: string;
  isPromoted: boolean;
}

export interface VariantsResponse {
  variants: VariantInfo[];
  contentType: string;
  slug: string;
  folderPath: string;
}

export interface ComponentItem {
  type: string;
  label: string;
  icon: Icon;
  description: string;
}

export interface TagInputProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  testId: string;
  transform?: (value: string) => string;
}

export interface TargetingStepProps {
  targetRegions: string[];
  setTargetRegions: (v: string[]) => void;
  targetDevices: string[];
  setTargetDevices: (v: string[]) => void;
  targetLocations: string[];
  setTargetLocations: (v: string[]) => void;
  targetUtmSources: string[];
  setTargetUtmSources: (v: string[]) => void;
  targetUtmCampaigns: string[];
  setTargetUtmCampaigns: (v: string[]) => void;
  targetUtmMediums: string[];
  setTargetUtmMediums: (v: string[]) => void;
  targetCountries: string[];
  setTargetCountries: (v: string[]) => void;
}
