import { createContext, useContext, type ReactNode } from "react";

export interface MenuVisualContextValue {
  isCompact: boolean;
  sectionBackgroundOverlapsMenu: boolean;
  topChromeHeightDesktop: number;
  topChromeHeightMobile: number;
}

const defaultValue: MenuVisualContextValue = {
  isCompact: false,
  sectionBackgroundOverlapsMenu: false,
  topChromeHeightDesktop: 0,
  topChromeHeightMobile: 0,
};

const MenuVisualContext = createContext<MenuVisualContextValue>(defaultValue);

interface MenuVisualProviderProps {
  children: ReactNode;
  value: Partial<MenuVisualContextValue>;
}

export function MenuVisualContextProvider({ children, value }: MenuVisualProviderProps) {
  const parentValue = useContext(MenuVisualContext);
  const mergedValue = {
    ...parentValue,
    ...value,
  };

  return <MenuVisualContext.Provider value={mergedValue}>{children}</MenuVisualContext.Provider>;
}

export function useMenuVisualContext(): MenuVisualContextValue {
  return useContext(MenuVisualContext);
}
