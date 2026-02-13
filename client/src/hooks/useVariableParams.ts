import { useMemo } from "react";
import { useSession } from "@/contexts/SessionContext";

export function useVariableQueryString(): string {
  const { session } = useSession();
  return useMemo(() => {
    const parts: string[] = [];
    if (session.location?.slug) {
      parts.push(`var_location=${encodeURIComponent(session.location.slug)}`);
    }
    if (session.location?.region) {
      parts.push(`var_region=${encodeURIComponent(session.location.region)}`);
    }
    return parts.length > 0 ? `&${parts.join("&")}` : "";
  }, [session.location?.slug, session.location?.region]);
}

export interface VariableInfo {
  path: string;
  variable: string;
  value: string;
  source: string;
  defaultValue: string;
}
