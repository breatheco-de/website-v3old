import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconFileText,
  IconExternalLink,
  IconRefresh,
  IconDatabase,
} from "@tabler/icons-react";
import type { MenuView } from "../types";

interface ContentTypeSummary {
  name: string;
  label: string;
  folder: string;
  has_database: boolean;
  database_slug: string | null;
  has_field_mapping: boolean;
}

interface ContentTypesViewProps {
  setMenuView: (v: MenuView) => void;
}

export function ContentTypesView({ setMenuView }: ContentTypesViewProps) {
  const { data, isLoading } = useQuery<ContentTypeSummary[]>({
    queryKey: ["/api/content-types"],
  });

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuView("main")}
              className="p-1 rounded-md hover-elevate"
              data-testid="button-back-to-main-content-types"
            >
              <IconArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="font-semibold text-sm">Content Types</h3>
              <p className="text-xs text-muted-foreground">
                {data ? `${data.length} type${data.length !== 1 ? "s" : ""}` : "Loading..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto overflow-x-hidden max-h-[280px]">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No content types found
            </div>
          ) : (
            data.map((ct) => (
              <div
                key={ct.name}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm"
                data-testid={`row-content-type-${ct.name}`}
              >
                <a
                  href={`/private/type/${ct.name}`}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover-elevate rounded-md -ml-1 pl-1 py-0.5"
                  data-testid={`link-content-type-${ct.name}`}
                >
                  <IconFileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ct.label}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      {ct.folder}
                      {ct.has_database && (
                        <span className="inline-flex items-center gap-0.5">
                          <IconDatabase className="h-3 w-3" />
                          {ct.database_slug}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
