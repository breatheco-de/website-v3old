import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Database, ExternalLink, MoreVertical, Plus, RefreshCw, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="font-semibold text-sm">Databases</h3>
              <p className="text-xs text-muted-foreground">
                {data ? `${data.length} database${data.length !== 1 ? "s" : ""}` : "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/private/databases?create=true"
              className="p-1.5 rounded hover-elevate"
              title="Create Database"
              data-testid="link-create-database"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </a>
            <a
              href="/private/databases"
              className="p-1.5 rounded hover-elevate"
              title="Open Databases Page"
              data-testid="link-databases-page"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto overflow-x-hidden max-h-[280px]">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No databases configured
            </div>
          ) : (
            data.map((db) => (
              <div
                key={db.name}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm"
                data-testid={`row-database-${db.name}`}
              >
                <a
                  href={`/private/databases/${db.name}`}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  data-testid={`link-database-${db.name}`}
                >
                  <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{db.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {db.description || `${db.source_type} · ${db.field_count} fields`}
                    </div>
                  </div>
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 rounded flex-shrink-0"
                      data-testid={`button-database-menu-${db.name}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[10001]">
                    <DropdownMenuItem asChild>
                      <a href={`/private/databases/${db.name}`} data-testid={`link-manage-database-${db.name}`}>
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Database
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
