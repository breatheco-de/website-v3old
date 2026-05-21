import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { HelpCircle, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getIcon, isCustomIcon } from "@/lib/icons";
import { getAllIconNames, getIconDisplayName, iconMatchesSearch } from "@/lib/icons-picker";

interface IconPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue?: string;
  onSelect: (iconName: string) => void;
  itemLabel?: string;
}

const INITIAL_ICONS = 200;
const ICONS_PER_LOAD = 60;

const allIconNames = getAllIconNames();

export function IconPickerModal({
  open,
  onOpenChange,
  currentValue,
  onSelect,
  itemLabel,
}: IconPickerModalProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_ICONS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) {
      return allIconNames;
    }
    const searchLower = search.toLowerCase();
    return allIconNames.filter((name) => iconMatchesSearch(name, searchLower));
  }, [search]);

  const visibleIcons = useMemo(() => {
    return filteredIcons.slice(0, visibleCount);
  }, [filteredIcons, visibleCount]);

  const hasMore = visibleCount < filteredIcons.length;

  useEffect(() => {
    setVisibleCount(INITIAL_ICONS);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setVisibleCount(INITIAL_ICONS);
      setSearch("");
    }
  }, [open]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setVisibleCount((prev) => Math.min(prev + ICONS_PER_LOAD, filteredIcons.length));
      setIsLoadingMore(false);
    });
  }, [hasMore, isLoadingMore, filteredIcons.length]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    if (scrollBottom < 100 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onOpenChange(false);
    setSearch("");
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = getIcon(iconName);
    if (!IconComponent) return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {currentValue && itemLabel 
              ? `Reemplazando ${currentValue.replace("Icon", "")} para ${itemLabel}`
              : "Seleccionar Icono"
            }
          </DialogTitle>
          <DialogDescription>
            Elige un icono de la lista
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar iconos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-icon-search"
            autoFocus
          />
        </div>

        <div 
          ref={scrollContainerRef}
          className="h-[350px] border rounded-md overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="grid grid-cols-6 gap-1 p-2">
            {visibleIcons.map((iconName) => {
              const isSelected = currentValue === iconName;
              const isCustom = isCustomIcon(iconName);
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => handleSelect(iconName)}
                  className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  } ${isCustom ? "ring-1 ring-primary/30" : ""}`}
                  title={`${getIconDisplayName(iconName)}${isCustom ? " (personalizado)" : ""}`}
                  data-testid={`icon-option-${iconName}`}
                >
                  {renderIcon(iconName)}
                </button>
              );
            })}
          </div>
          
          {hasMore && (
            <div className="flex items-center justify-center py-4">
              {isLoadingMore ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Desplázate para cargar más...
                </span>
              )}
            </div>
          )}
          
          {filteredIcons.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
              No se encontraron iconos
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Mostrando {visibleIcons.length} de {filteredIcons.length} iconos
          {filteredIcons.length !== allIconNames.length && ` (${allIconNames.length} total)`}.
          {search && " Limpia la búsqueda para ver todos."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
