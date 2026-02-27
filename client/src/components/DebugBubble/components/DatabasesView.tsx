import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconDatabase,
  IconExternalLink,
  IconRefresh,
  IconApi,
} from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MenuView } from "../types";

interface DatabaseSummary {
  name: string;
  label: string;
  description: string | null;
  source_type: string;
  field_count: number;
}

interface DatabasesViewProps {
  setMenuView: (v: MenuView) => void;
}

export function DatabasesView({ setMenuView }: DatabasesViewProps) {
  const { data, isLoading } = useQuery<DatabaseSummary[]>({
    queryKey: ["/api/databases"],
  });

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuView("main")}
              className="p-1 rounded-md hover-elevate"
              data-testid="button-back-to-main-databases"
            >
              <IconArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="font-semibold text-sm">Databases</h3>
              <p className="text-xs text-muted-foreground">
                {data ? `${data.length} database${data.length !== 1 ? "s" : ""}` : "Loading..."}
              </p>
            </div>
          </div>
          <a
            href="/private/databases"
            className="p-1.5 rounded hover-elevate"
            title="Open Databases Page"
            data-testid="link-databases-page"
          >
            <IconExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </div>

      <ScrollArea className="h-[280px]">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No databases configured
            </div>
          ) : (
            data.map((db) => (
              <a
                key={db.name}
                href={`/private/databases/${db.name}`}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate cursor-pointer"
                data-testid={`link-database-${db.name}`}
              >
                <IconDatabase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{db.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {db.description || `${db.source_type} · ${db.field_count} fields`}
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}
