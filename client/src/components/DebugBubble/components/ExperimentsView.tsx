import { deslugify } from "../utils/debugHelpers";
import { ArrowLeft, FlaskConical, Plus, RefreshCw } from "lucide-react";
import type { MenuView, ContentInfo, ExperimentsResponse } from "../types";

interface ExperimentsViewProps {
  setMenuView: (v: MenuView) => void;
  contentInfo: ContentInfo;
  experimentsLoading: boolean;
  experimentsData: ExperimentsResponse | null;
  handleLinkClick: (e: React.MouseEvent) => void;
}

export function ExperimentsView({
  setMenuView,
  contentInfo,
  experimentsLoading,
  experimentsData,
  handleLinkClick,
}: ExperimentsViewProps) {
  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuView("main")}
              className="p-1 rounded-md hover-elevate"
              data-testid="button-back-to-main-experiments"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="font-semibold text-sm">Experiments</h3>
              <p className="text-xs text-muted-foreground">
                {contentInfo.label}: {contentInfo.slug}
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded hover-elevate"
            title="Create new experiment"
            data-testid="button-create-experiment"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto overflow-x-hidden max-h-[280px]">
        <div className="p-2 space-y-1">
          {experimentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !experimentsData?.hasExperimentsFile ? (
            <div className="text-center py-8 px-4">
              <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">No experiments file found</p>
              <p className="text-xs text-muted-foreground">
                Create <code className="bg-muted px-1 rounded">experiments.yml</code> in the content folder
              </p>
            </div>
          ) : experimentsData.experiments.length === 0 ? (
            <div className="text-center py-8 px-4">
              <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No experiments defined</p>
            </div>
          ) : (
            experimentsData.experiments.map((experiment) => {
              const statusColors: Record<string, string> = {
                planned: "bg-muted text-muted-foreground",
                active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                winner: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                archived: "bg-muted text-muted-foreground opacity-60",
              };
              const totalExposures = Object.values(experiment.stats || {}).reduce((a, b) => a + b, 0);
              
              return (
                <a
                  key={experiment.slug}
                  href={`/private/${contentInfo.type}/${contentInfo.slug}/experiment/${experiment.slug}`}
                  onClick={handleLinkClick}
                  className="flex flex-col w-full px-3 py-2.5 rounded-md text-sm hover-elevate cursor-pointer text-left"
                  data-testid={`button-experiment-${experiment.slug}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-medium">{deslugify(experiment.slug)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[experiment.status]}`}>
                      {experiment.status}
                    </span>
                  </div>
                  {experiment.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {experiment.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{experiment.variants.length} variants</span>
                    {totalExposures > 0 && (
                      <span>{totalExposures} exposures</span>
                    )}
                    {experiment.max_visitors && (
                      <span>max {experiment.max_visitors}</span>
                    )}
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
