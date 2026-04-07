import { useNavbarOverlay } from "@/contexts/NavbarOverlayContext";

export function NavbarContentWrapper({ children }: { children: React.ReactNode }) {
  const { state } = useNavbarOverlay();

  if (!state.subtleAtTopEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      style={
        {
          "--navbar-pt-mobile": `${state.mobileHeight}px`,
          "--navbar-pt-desktop": `${state.desktopHeight}px`,
          paddingTop: `var(--navbar-pt-mobile)`,
        } as React.CSSProperties
      }
      className="md:[padding-top:var(--navbar-pt-desktop)]"
    >
      {children}
    </div>
  );
}
