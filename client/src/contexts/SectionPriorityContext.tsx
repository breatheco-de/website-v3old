import { createContext, useContext } from "react";

const SectionPriorityContext = createContext<boolean>(false);

export const SectionPriorityProvider = SectionPriorityContext.Provider;

export function useSectionPriority(): boolean {
  return useContext(SectionPriorityContext);
}
