import { useEffect } from "react";
import { useEditModeOptional } from "@/contexts/EditModeContext";
import { subscribeToContentUpdates, ContentUpdatedPayload } from "@/lib/contentEvents";

export function useContentAutoRefresh(
  contentType: string | undefined,
  slug: string | undefined,
  locale: string | undefined,
  refetch: () => void
): void {
  const editMode = useEditModeOptional();

  useEffect(() => {
    if (!editMode?.isEditMode || !contentType || !slug || !locale) {
      return;
    }

    const unsubscribe = subscribeToContentUpdates((payload: ContentUpdatedPayload) => {
      if (payload.contentType === contentType && payload.slug === slug && payload.locale === locale) {
        refetch();
      }
    });

    return unsubscribe;
  }, [editMode?.isEditMode, contentType, slug, locale, refetch]);
}
