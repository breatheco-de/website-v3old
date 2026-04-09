import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface MenuVisualContextValue {
  isCompact: boolean;
  sectionBackgroundOverlapsMenu: boolean;
  sectionBackgroundOverlapHeight: number;
  setSectionBackgroundOverlapHeight: (height: number) => void;
}

const defaultValue: MenuVisualContextValue = {
  isCompact: false,
  sectionBackgroundOverlapsMenu: false,
  sectionBackgroundOverlapHeight: 0,
  setSectionBackgroundOverlapHeight: () => {},
};

const MenuVisualContext = createContext<MenuVisualContextValue>(defaultValue);

interface MenuVisualProviderProps {
  children: ReactNode;
  value: Partial<MenuVisualContextValue>;
}

export function MenuVisualContextProvider({ children, value }: MenuVisualProviderProps) {
  const parentValue = useContext(MenuVisualContext);
  const mergedValue = useMemo(
    () => ({
      ...parentValue,
      ...value,
    }),
    [parentValue, value],
  );

  return <MenuVisualContext.Provider value={mergedValue}>{children}</MenuVisualContext.Provider>;
}

export function useMenuVisualContext(): MenuVisualContextValue {
  return useContext(MenuVisualContext);
}
