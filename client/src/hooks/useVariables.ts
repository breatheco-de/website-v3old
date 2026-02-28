import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession } from "@/contexts/SessionContext";
import {
  resolveDeep,
  resolveTemplateString,
  type VariableDefinition,
  type VariableContext,
  type ResolvedVariable,
} from "@/lib/variable-manager";

export function useVariableDefinitions() {
  return useQuery<Record<string, VariableDefinition>>({
    queryKey: ["/api/variables"],
    staleTime: 60_000,
  });
}

export function useVariableContext(): VariableContext {
  const { session } = useSession();
  return useMemo(() => ({
    location: session.location?.slug,
    region: session.location?.region,
    locale: session.language,
  }), [session.location?.slug, session.location?.region, session.language]);
}

export function useResolvedContent<T>(rawData: T | undefined): {
  data: T | undefined;
  variables: ResolvedVariable[];
  definitions: Record<string, VariableDefinition>;
  context: VariableContext;
} {
  const { data: definitions } = useVariableDefinitions();
  const context = useVariableContext();

  return useMemo(() => {
    if (!rawData || !definitions) {
      return { data: rawData, variables: [], definitions: definitions || {}, context };
    }

    const result = resolveDeep(rawData, definitions, context);
    return {
      data: result.data as T,
      variables: result.variables,
      definitions,
      context,
    };
  }, [rawData, definitions, context]);
}

export function useResolveString() {
  const { data: definitions } = useVariableDefinitions();
  const context = useVariableContext();

  return useMemo(() => {
    if (!definitions) return (text: string) => ({ text, variables: [] as ResolvedVariable[] });
    return (text: string) => resolveTemplateString(text, definitions, context);
  }, [definitions, context]);
}
