import { createContext, useContext, useState } from "react";

interface NavbarOverlayState {
  subtleAtTopEnabled: boolean;
  desktopHeight: number;
  mobileHeight: number;
}

interface NavbarOverlayContextValue {
  state: NavbarOverlayState;
  setState: (s: NavbarOverlayState) => void;
}

const NavbarOverlayContext = createContext<NavbarOverlayContextValue>({
  state: { subtleAtTopEnabled: false, desktopHeight: 0, mobileHeight: 0 },
  setState: () => {},
});

export function NavbarOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavbarOverlayState>({
    subtleAtTopEnabled: false,
    desktopHeight: 0,
    mobileHeight: 0,
  });

  return (
    <NavbarOverlayContext.Provider value={{ state, setState }}>
      {children}
    </NavbarOverlayContext.Provider>
  );
}

export function useNavbarOverlay() {
  return useContext(NavbarOverlayContext);
}
