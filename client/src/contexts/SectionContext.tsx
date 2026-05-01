import { createContext, useContext } from "react";

export interface SectionContextValue {
  isPriority: boolean;
  sectionIndex: number;
  contentType: string;
  slug: string;
  locale: string;
  variableFields?: Record<string, string>;
  variableKeys?: Record<string, string>;
}

const defaultValue: SectionContextValue = {
  isPriority: false,
  sectionIndex: -1,
  contentType: "",
  slug: "",
  locale: "",
  variableFields: undefined,
  variableKeys: undefined,
};

const SectionContext = createContext<SectionContextValue>(defaultValue);

export const SectionContextProvider = SectionContext.Provider;

export function useSectionContext(): SectionContextValue {
  return useContext(SectionContext);
}

export function useSectionPriority(): boolean {
  return useContext(SectionContext).isPriority;
}
