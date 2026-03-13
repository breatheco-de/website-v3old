import { useParams, useLocation } from "wouter";
import { getDebugUserName } from "@/hooks/useDebugAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import yaml from "js-yaml";
import { escapeTemplateVars, escapeObjectVars, unescapeObjectVars, unescapeYamlDump } from "@shared/templateVars";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconRefresh,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronRight,
  IconGripVertical,
  IconMenu2,
  IconLink,
  IconCode,
  IconFileCode,
  IconVariable,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { VariableDetailModal } from "@/components/editing/VariableDetailModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditableDropdownPreview, EditableLinkItem, EditableText } from "@/components/menus";
import { useImageRegistry } from "@/components/UniversalImage";
import { IconPhoto, IconSearch, IconCheck } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function safeYamlDump(obj: unknown, opts?: yaml.DumpOptions): string {
  const { escaped, map } = escapeObjectVars(obj);
  const dumped = yaml.dump(escaped, opts);
  return unescapeYamlDump(dumped, map);
}

interface MenuItemData {
  label: string;
  href: string;
  component: string;
  imageId?: string;
  dropdown?: {
    type: string;
    title?: string;
    description?: string;
    icon?: string;
    items?: Array<{
      label?: string;
      title?: string;
      description?: string;
      cta?: string;
      href: string;
      icon?: string;
    }>;
    columns?: Array<{
      title: string;
      items: Array<{ label: string; href: string }>;
    }>;
    groups?: Array<{
      title: string;
      items: Array<{ label: string; href: string }>;
    }>;
    footer?: {
      text: string;
      linkText: string;
      href: string;
    };
  };
}

interface FooterColumnItem {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  items: FooterColumnItem[];
}

interface FooterSocial {
  name: string;
  icon: string;
  link: string;
}

interface FooterLegalLink {
  label: string;
  href: string;
}

interface FooterData {
  columns: FooterColumn[];
  socials: FooterSocial[];
  legal_links: FooterLegalLink[];
  copyright_text: string;
}

interface MenuData {
  navbar?: {
    items: MenuItemData[];
  };
  footer?: FooterData;
  [key: string]: unknown;
}

interface MenuResponse {
  name: string;
  data: MenuData;
  rawYaml?: string;
}

const componentOptions = [
  { value: "SimpleLink", label: "Simple Link" },
  { value: "Dropdown", label: "Dropdown Menu" },
  { value: "Logo", label: "Logo (Universal Image)" },
  { value: "LanguageSwitcher", label: "Language Switcher" },
];

const dropdownTypes = [
  { value: "cards", label: "Cards" },
  { value: "columns", label: "Columns" },
  { value: "simple-list", label: "Simple List" },
  { value: "grouped-list", label: "Grouped List" },
];

function LogoImagePreview({
  imageId,
  onImageIdChange,
  isReadOnlyStructure,
}: {
  imageId: string;
  onImageIdChange: (newImageId: string) => void;
  isReadOnlyStructure: boolean;
}) {
  const { registry } = useImageRegistry();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedId, setSelectedId] = useState(imageId);
  const [visibleCount, setVisibleCount] = useState(48);

  const imageEntry = imageId && registry?.images?.[imageId] ? registry.images[imageId] : null;
  const displaySrc = imageEntry?.src || (imageId && (imageId.startsWith("/") || imageId.startsWith("http")) ? imageId : "");

  const filteredImages = useMemo(() => {
    if (!registry?.images) return [];
    const entries = Object.entries(registry.images);
    if (!pickerSearch.trim()) return entries;
    const search = pickerSearch.toLowerCase();
    return entries.filter(([id, img]) =>
      id.toLowerCase().includes(search) ||
      img.alt?.toLowerCase().includes(search) ||
      img.tags?.some(t => t.toLowerCase().includes(search))
    );
  }, [registry?.images, pickerSearch]);

  const handleOpenPicker = () => {
    if (isReadOnlyStructure) return;
    setSelectedId(imageId);
    setPickerSearch("");
    setVisibleCount(48);
    setPickerOpen(true);
  };

  const handleSave = () => {
    onImageIdChange(selectedId);
    setPickerOpen(false);
  };

  const selectedEntry = selectedId && registry?.images?.[selectedId] ? registry.images[selectedId] : null;
  const selectedDisplaySrc = selectedEntry?.src || "";

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <IconPhoto className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Image Preview</span>
      </div>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={isReadOnlyStructure}
          className="relative w-24 h-16 rounded-md overflow-hidden bg-muted border flex-shrink-0 flex items-center justify-center group cursor-pointer disabled:cursor-default"
          data-testid="button-logo-image-picker"
          title={isReadOnlyStructure ? "Read-only" : "Click to change image"}
        >
          {displaySrc ? (
            <>
              <img
                src={displaySrc}
                alt={imageEntry?.alt || "Logo"}
                className="w-full h-full object-contain"
                data-testid="logo-preview-image"
              />
              {!isReadOnlyStructure && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <IconPhoto className="h-5 w-5 text-white" />
                </div>
              )}
            </>
          ) : (
            <IconPhoto className="h-6 w-6 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Image ID</Label>
            <Input
              value={imageId}
              onChange={(e) => onImageIdChange(e.target.value)}
              placeholder="image-registry-id"
              className="text-sm font-mono"
              disabled={isReadOnlyStructure}
              data-testid="input-logo-image-id"
            />
          </div>
          {imageEntry && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {imageEntry.alt && (
                <div>
                  <span className="font-medium">Alt:</span> {imageEntry.alt}
                </div>
              )}
              {imageEntry.width && imageEntry.height && (
                <div>
                  <span className="font-medium">Size:</span> {imageEntry.width} x {imageEntry.height}
                </div>
              )}
              {imageEntry.format && (
                <div>
                  <span className="font-medium">Format:</span> {imageEntry.format}
                </div>
              )}
              {imageEntry.tags && imageEntry.tags.length > 0 && (
                <div>
                  <span className="font-medium">Tags:</span> {imageEntry.tags.join(", ")}
                </div>
              )}
            </div>
          )}
          {imageId && !imageEntry && !displaySrc && (
            <p className="text-xs text-destructive">Image not found in registry</p>
          )}
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Logo Image</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-10"
                data-testid="input-logo-gallery-search"
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="columns-4 sm:columns-5 md:columns-6 gap-2">
                {filteredImages.slice(0, visibleCount).map(([id, img]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`mb-2 rounded-md overflow-hidden bg-muted border-2 transition-colors block w-full ${
                      selectedId === id
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    title={img.alt}
                    data-testid={`logo-gallery-image-${id}`}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              {visibleCount < filteredImages.length && (
                <div className="py-3 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(prev => Math.min(prev + 24, filteredImages.length))}
                    data-testid="button-logo-load-more"
                  >
                    Load more ({filteredImages.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
              {filteredImages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No images found
                </div>
              )}
            </div>

            {selectedId && selectedEntry && (
              <div className="border-t pt-3">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted border flex-shrink-0">
                    <img
                      src={selectedDisplaySrc}
                      alt={selectedEntry.alt || "Selected"}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{selectedId}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedEntry.alt}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
              data-testid="button-logo-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!selectedId}
              data-testid="button-logo-picker-save"
            >
              <IconCheck className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableMenuItemEditor({
  id,
  item,
  index,
  onUpdate,
  onDelete,
  isExpanded,
  onToggleExpand,
  isReadOnlyStructure = false,
  locale = "en",
}: {
  id: string;
  item: MenuItemData;
  index: number;
  onUpdate: (index: number, item: MenuItemData) => void;
  onDelete?: (index: number) => void;
  isExpanded: boolean;
  onToggleExpand: (index: number) => void;
  isReadOnlyStructure?: boolean;
  locale?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-2">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          {!isReadOnlyStructure ? (
            <button
              className="touch-none cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
              data-testid={`button-drag-item-${index}`}
            >
              <IconGripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <IconGripVertical className="h-4 w-4 text-muted-foreground/30" />
          )}
          <button
            onClick={() => onToggleExpand(index)}
            className="flex items-center gap-2 flex-1 text-left"
            data-testid={`button-expand-item-${index}`}
          >
            {isExpanded ? (
              <IconChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <IconChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <IconMenu2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{item.label || "Untitled"}</span>
          </button>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {item.component}
          </span>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(index)}
              className="h-8 w-8 text-destructive hover:text-destructive"
              data-testid={`button-delete-item-${index}`}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`label-${index}`}>Label</Label>
              <Input
                id={`label-${index}`}
                value={item.label}
                onChange={(e) => onUpdate(index, { ...item, label: e.target.value })}
                placeholder="Menu label"
                data-testid={`input-label-${index}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`href-${index}`}>URL</Label>
              <div className="relative">
                <IconLink className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id={`href-${index}`}
                  value={item.href}
                  onChange={(e) => onUpdate(index, { ...item, href: e.target.value })}
                  placeholder="/page-url"
                  className="pl-8"
                  data-testid={`input-href-${index}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`component-${index}`}>Component</Label>
              <Select
                value={item.component}
                onValueChange={(value) => {
                  const updatedItem = { ...item, component: value };
                  if (value === "Dropdown" && !item.dropdown) {
                    updatedItem.dropdown = {
                      type: "simple-list",
                      title: item.label,
                      description: "",
                      items: [],
                      columns: [],
                      groups: [],
                    };
                  }
                  onUpdate(index, updatedItem);
                }}
                disabled={isReadOnlyStructure}
              >
                <SelectTrigger data-testid={`select-component-${index}`}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {componentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <IconCode className="h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dropdown Type</Label>
              <Select
                value={item.dropdown?.type || "simple-list"}
                onValueChange={(value) => {
                  const currentDropdown = item.dropdown || {
                    type: "simple-list",
                    title: item.label,
                    description: "",
                    items: [],
                    columns: [],
                    groups: [],
                  };
                  onUpdate(index, {
                    ...item,
                    dropdown: { ...currentDropdown, type: value },
                  });
                }}
                disabled={item.component !== "Dropdown" || isReadOnlyStructure}
              >
                <SelectTrigger data-testid={`select-dropdown-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dropdownTypes.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {item.component === "Dropdown" && item.dropdown && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Dropdown Preview</span>
                <span className="text-xs text-muted-foreground">(Click elements to edit)</span>
              </div>
              <EditableDropdownPreview
                dropdown={item.dropdown as any}
                onChange={(updatedDropdown) =>
                  onUpdate(index, {
                    ...item,
                    dropdown: updatedDropdown as any,
                  })
                }
                isReadOnlyStructure={isReadOnlyStructure}
                locale={locale}
              />
            </div>
          )}
          {item.component === "Logo" && (
            <LogoImagePreview
              imageId={item.imageId || ""}
              onImageIdChange={(newImageId) =>
                onUpdate(index, { ...item, imageId: newImageId })
              }
              isReadOnlyStructure={isReadOnlyStructure}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SortableFooterItem({
  id,
  item,
  colIndex,
  itemIndex,
  isEnglish,
  locale,
  onUpdateColumnItem,
  onDeleteColumnItem,
}: {
  id: string;
  item: FooterColumnItem;
  colIndex: number;
  itemIndex: number;
  isEnglish: boolean;
  locale: string;
  onUpdateColumnItem: (colIndex: number, itemIndex: number, updates: Partial<FooterColumnItem>) => void;
  onDeleteColumnItem: (colIndex: number, itemIndex: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-0.5">
      <button
        className="touch-none cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
        data-testid={`button-drag-footer-column-${colIndex}-item-${itemIndex}`}
      >
        <IconGripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <EditableLinkItem
          label={item.label || ""}
          href={item.href || ""}
          onLabelChange={(label) => onUpdateColumnItem(colIndex, itemIndex, { label })}
          onHrefChange={(href) => onUpdateColumnItem(colIndex, itemIndex, { href })}
          onSave={(label, href) => onUpdateColumnItem(colIndex, itemIndex, { label, href })}
          onDelete={() => onDeleteColumnItem(colIndex, itemIndex)}
          testIdPrefix={`footer-column-${colIndex}-item-${itemIndex}`}
          isReadOnlyStructure={false}
          locale={locale}
        />
      </div>
    </li>
  );
}

function SortableFooterColumn({
  id,
  column,
  colIndex,
  isEnglish,
  locale,
  onDeleteColumn,
  onUpdateColumn,
  onUpdateColumnItem,
  onDeleteColumnItem,
  onAddColumnItem,
}: {
  id: string;
  column: FooterColumn;
  colIndex: number;
  isEnglish: boolean;
  locale: string;
  onDeleteColumn: (index: number) => void;
  onUpdateColumn: (index: number, updates: Partial<FooterColumn>) => void;
  onUpdateColumnItem: (colIndex: number, itemIndex: number, updates: Partial<FooterColumnItem>) => void;
  onDeleteColumnItem: (colIndex: number, itemIndex: number) => void;
  onAddColumnItem: (colIndex: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/col relative border rounded-lg p-2" data-testid={`footer-column-${colIndex}`}>
      <div className="flex items-center gap-1 mb-2">
        <button
          className="touch-none cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          data-testid={`button-drag-footer-column-${colIndex}`}
        >
          <IconGripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <EditableText
          value={column.title}
          onChange={(title) => onUpdateColumn(colIndex, { title })}
          placeholder="Column title"
          className="font-semibold text-foreground block flex-1"
          as="h4"
          testId={`footer-column-${colIndex}-title`}
        />
        <button
          onClick={() => onDeleteColumn(colIndex)}
          className="p-1 rounded-md bg-destructive/10 text-destructive opacity-0 group-hover/col:opacity-100 transition-opacity"
          data-testid={`footer-column-${colIndex}-delete`}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
      <SortableContext
        items={(column.items || []).map((_, i) => `footer-col-${colIndex}-item-${i}`)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-1">
          {(column.items || []).map((item, itemIndex) => (
            <SortableFooterItem
              key={`footer-col-${colIndex}-item-${itemIndex}`}
              id={`footer-col-${colIndex}-item-${itemIndex}`}
              item={item}
              colIndex={colIndex}
              itemIndex={itemIndex}
              isEnglish={isEnglish}
              locale={locale}
              onUpdateColumnItem={onUpdateColumnItem}
              onDeleteColumnItem={onDeleteColumnItem}
            />
          ))}
          <li>
            <button
              onClick={() => onAddColumnItem(colIndex)}
              className="flex items-center gap-1 text-sm text-muted-foreground/50 hover:text-primary py-1"
              data-testid={`footer-column-${colIndex}-add-item`}
            >
              <IconPlus className="h-3 w-3" />
              Add item
            </button>
          </li>
        </ul>
      </SortableContext>
    </div>
  );
}

interface MenuUsageResponse {
  defaultContentTypes: Array<{ name: string; position: "top" | "bottom" }>;
  overrides: Array<{ contentType: string; slug: string; source: string; position: "top" | "bottom" }>;
}

function MenuUsageInfo({ menuName }: { menuName: string }) {
  const { data, isLoading } = useQuery<MenuUsageResponse>({
    queryKey: ["/api/menus", menuName, "usage"],
    queryFn: async () => {
      const response = await fetch(`/api/menus/${menuName}/usage`);
      if (!response.ok) throw new Error("Failed to load usage");
      return response.json();
    },
    enabled: !!menuName,
  });

  if (isLoading) {
    return (
      <div className="bg-muted rounded-md p-4 mb-6" data-testid="menu-usage-skeleton">
        <div className="flex items-start gap-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { defaultContentTypes, overrides } = data;
  const hasDefaults = defaultContentTypes.length > 0;
  const hasOverrides = overrides.length > 0;

  if (!hasDefaults && !hasOverrides) {
    return (
      <div className="bg-muted rounded-md p-4 mb-6 flex items-start gap-3" data-testid="menu-usage-empty">
        <IconInfoCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <span className="text-sm text-muted-foreground">
          This menu is not currently assigned to any content.
        </span>
      </div>
    );
  }

  const typeNames = defaultContentTypes.map((ct) => ct.name);

  return (
    <div className="bg-muted rounded-md p-4 mb-6 flex items-start gap-3" data-testid="menu-usage-info">
      <IconInfoCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-sm text-muted-foreground">
        {hasDefaults && (
          <>
            This menu is displayed in all{" "}
            {typeNames.map((name, i) => (
              <span key={name}>
                {i > 0 && i < typeNames.length - 1 && ", "}
                {i > 0 && i === typeNames.length - 1 && " and "}
                <strong className="text-foreground">{name}s</strong>
              </span>
            ))}
          </>
        )}
        {!hasDefaults && hasOverrides && "This menu is used in "}
        {hasOverrides && hasDefaults && " and "}
        {hasOverrides && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-primary underline underline-offset-2 hover:text-primary/80 inline"
                data-testid="button-show-overrides"
              >
                {overrides.length} additional URL{overrides.length !== 1 ? "s" : ""}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-60 overflow-auto" align="start">
              <div className="space-y-1">
                <p className="text-sm font-medium mb-2">Per-entry overrides</p>
                {overrides.map((o, i) => (
                  <div
                    key={`${o.contentType}-${o.slug}-${o.position}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs py-1 border-b last:border-0"
                    data-testid={`override-item-${i}`}
                  >
                    <span className="text-foreground truncate">
                      {o.contentType}/{o.slug}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {o.source} ({o.position})
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        .
      </span>
    </div>
  );
}

export default function MenuEditor() {
  const params = useParams<{ menuName: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const menuName = params.menuName || "";

  const [locale, setLocale] = useState<string>("en");
  const [pendingLocaleSwitch, setPendingLocaleSwitch] = useState<string | null>(null);
  const [yamlSource, setYamlSource] = useState<string>("");
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [showSourceSidebar, setShowSourceSidebar] = useState(false);
  const [originalYaml, setOriginalYaml] = useState<string>("");
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const cmSidebarRef = useRef<ReactCodeMirrorRef>(null);
  const activeEditorRef = useRef<"main" | "sidebar">("main");
  
  const isEnglish = locale === "en";

  const parsedResult = useMemo<{ data: MenuData | null; error: string | null }>(() => {
    if (!yamlSource) return { data: null, error: null };
    try {
      const { escaped, map } = escapeTemplateVars(yamlSource);
      const parsed = unescapeObjectVars(yaml.load(escaped), map) as MenuData;
      return { data: parsed, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Invalid YAML" };
    }
  }, [yamlSource]);

  const menuData = parsedResult.data;

  useEffect(() => {
    setYamlError(parsedResult.error);
  }, [parsedResult.error]);

  const updateYamlFromData = useCallback((newData: MenuData) => {
    try {
      const newYaml = safeYamlDump(newData, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
      });
      setYamlSource(newYaml);
      setHasChanges(true);
    } catch (e) {
      console.error("Failed to serialize YAML:", e);
    }
  }, []);

  const { data, isLoading, error, refetch } = useQuery<MenuResponse>({
    queryKey: ["/api/menus", menuName, locale],
    queryFn: async () => {
      const response = await fetch(`/api/menus/${menuName}?locale=${locale}&raw=true`);
      if (!response.ok) throw new Error("Failed to load menu");
      return response.json();
    },
    enabled: !!menuName,
  });

  useEffect(() => {
    if (data?.data) {
      const initialYaml = safeYamlDump(data.data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
      });
      setYamlSource(initialYaml);
      setOriginalYaml(initialYaml);
      setHasChanges(false);
    }
  }, [data]);
  
  const handleLocaleSwitch = (newLocale: string) => {
    if (newLocale === locale) return;
    
    if (hasChanges) {
      setPendingLocaleSwitch(newLocale);
    } else {
      setLocale(newLocale);
    }
  };
  
  const confirmLocaleSwitch = () => {
    if (pendingLocaleSwitch) {
      setLocale(pendingLocaleSwitch);
      setPendingLocaleSwitch(null);
      setHasChanges(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (yamlContent: string) => {
      const { escaped, map } = escapeTemplateVars(yamlContent);
      const parsedData = unescapeObjectVars(yaml.load(escaped), map) as MenuData;
      
      // Use different endpoints based on locale:
      // - English: structure endpoint (propagates to all translations)
      // - Other locales: translations endpoint (text-only changes)
      if (isEnglish) {
        return apiRequest("PUT", `/api/menus/${menuName}/structure`, { data: parsedData, author: getDebugUserName() });
      } else {
        return apiRequest("PUT", `/api/menus/${menuName}/translations?locale=${locale}`, { data: parsedData, author: getDebugUserName() });
      }
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menus", menuName, "en"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus", menuName, "es"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus"] });
      refetch();
      setOriginalYaml(yamlSource);
      setHasChanges(false);
      
      const syncMessage = response.syncResults && Object.keys(response.syncResults).length > 0
        ? ` Synced to: ${Object.keys(response.syncResults).join(", ")}`
        : "";
      
      const endpointMessage = isEnglish 
        ? `Structure saved and synced to translations.${syncMessage}`
        : `${locale.toUpperCase()} translations saved.`;
      
      toast({
        title: "Menu saved",
        description: `${endpointMessage} Refresh the homepage to see updates.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving menu",
        description: error instanceof Error ? error.message : "Failed to save menu",
        variant: "destructive",
      });
    },
  });

  const isNavbarMenu = !!(menuData?.navbar?.items);
  const isFooterMenu = !!(menuData?.footer);
  const footerData = menuData?.footer;

  const updateFooter = (updates: Partial<FooterData>) => {
    if (!menuData || !footerData) return;
    updateYamlFromData({ ...menuData, footer: { ...footerData, ...updates } });
  };

  const updateFooterColumn = (colIndex: number, updates: Partial<FooterColumn>) => {
    if (!footerData) return;
    const newColumns = [...footerData.columns];
    newColumns[colIndex] = { ...newColumns[colIndex], ...updates };
    updateFooter({ columns: newColumns });
  };

  const updateFooterColumnItem = (colIndex: number, itemIndex: number, updates: Partial<FooterColumnItem>) => {
    if (!footerData) return;
    const newColumns = [...footerData.columns];
    const newItems = [...(newColumns[colIndex].items || [])];
    newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    updateFooter({ columns: newColumns });
  };

  const addFooterColumnItem = (colIndex: number) => {
    if (!footerData) return;
    const newColumns = [...footerData.columns];
    newColumns[colIndex] = {
      ...newColumns[colIndex],
      items: [...(newColumns[colIndex].items || []), { label: "New Item", href: "/new-page" }],
    };
    updateFooter({ columns: newColumns });
  };

  const deleteFooterColumnItem = (colIndex: number, itemIndex: number) => {
    if (!footerData) return;
    const newColumns = [...footerData.columns];
    newColumns[colIndex] = {
      ...newColumns[colIndex],
      items: (newColumns[colIndex].items || []).filter((_, i) => i !== itemIndex),
    };
    updateFooter({ columns: newColumns });
  };

  const reorderFooterColumnItems = (colIndex: number, oldIndex: number, newIndex: number) => {
    if (!footerData) return;
    const newColumns = [...footerData.columns];
    const items = [...(newColumns[colIndex].items || [])];
    newColumns[colIndex] = { ...newColumns[colIndex], items: arrayMove(items, oldIndex, newIndex) };
    updateFooter({ columns: newColumns });
  };

  const addFooterColumn = () => {
    if (!footerData) return;
    updateFooter({ columns: [...footerData.columns, { title: "New Column", items: [] }] });
  };

  const deleteFooterColumn = (colIndex: number) => {
    if (!footerData) return;
    updateFooter({ columns: footerData.columns.filter((_, i) => i !== colIndex) });
  };

  const updateFooterSocial = (index: number, updates: Partial<FooterSocial>) => {
    if (!footerData) return;
    const newSocials = [...(footerData.socials || [])];
    newSocials[index] = { ...newSocials[index], ...updates };
    updateFooter({ socials: newSocials });
  };

  const addFooterSocial = () => {
    if (!footerData) return;
    updateFooter({ socials: [...(footerData.socials || []), { name: "New Social", icon: "linkedin", link: "https://" }] });
  };

  const deleteFooterSocial = (index: number) => {
    if (!footerData) return;
    updateFooter({ socials: (footerData.socials || []).filter((_, i) => i !== index) });
  };

  const updateFooterLegalLink = (index: number, updates: Partial<FooterLegalLink>) => {
    if (!footerData) return;
    const newLinks = [...(footerData.legal_links || [])];
    newLinks[index] = { ...newLinks[index], ...updates };
    updateFooter({ legal_links: newLinks });
  };

  const addFooterLegalLink = () => {
    if (!footerData) return;
    updateFooter({ legal_links: [...(footerData.legal_links || []), { label: "New Link", href: "/new-page" }] });
  };

  const deleteFooterLegalLink = (index: number) => {
    if (!footerData) return;
    updateFooter({ legal_links: (footerData.legal_links || []).filter((_, i) => i !== index) });
  };

  const handleUpdateItem = (index: number, updatedItem: MenuItemData) => {
    if (!menuData || !menuData.navbar) return;
    const newItems = [...menuData.navbar.items];
    newItems[index] = updatedItem;
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
  };

  const handleDeleteItem = (index: number) => {
    if (!menuData || !menuData.navbar) return;
    const newItems = menuData.navbar.items.filter((_, i) => i !== index);
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
    setConfirmDeleteIndex(null);
  };

  const handleAddItem = () => {
    if (!menuData || !menuData.navbar) return;
    const newItem: MenuItemData = {
      label: "NEW ITEM",
      href: "/new-page",
      component: "SimpleLink",
    };
    const newItems = [...menuData.navbar.items, newItem];
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
    setExpandedItems(new Set([...Array.from(expandedItems), newItems.length - 1]));
  };

  const handleSave = () => {
    if (!yamlSource || yamlError) return;
    saveMutation.mutate(yamlSource);
  };

  const handleYamlEdit = (newYaml: string) => {
    setYamlSource(newYaml);
    setHasChanges(newYaml !== originalYaml);
  };

  const handleCmUpdate = useCallback((update: import("@codemirror/view").ViewUpdate) => {
    const sel = update.state.selection.main;
    const text = sel.empty ? "" : update.state.sliceDoc(sel.from, sel.to);
    setSelectedText(text);
  }, []);

  const handleVariableCreated = useCallback((_varName: string, templateSyntax: string) => {
    const ref = activeEditorRef.current === "sidebar" ? cmSidebarRef : cmRef;
    const view = ref.current?.view;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: templateSyntax },
      selection: { anchor: from + templateSyntax.length },
    });

    const newVal = view.state.doc.toString();
    handleYamlEdit(newVal);
  }, [handleYamlEdit]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!menuData || !menuData.navbar || !over || active.id === over.id) return;

    const items = menuData.navbar.items;
    const oldIndex = items.findIndex((_, i) => `item-${i}` === active.id);
    const newIndex = items.findIndex((_, i) => `item-${i}` === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedItem = items[oldIndex];
    const targetItem = items[newIndex];
    const isSpecial = (item: { component: string }) => item.component === "Logo" || item.component === "LanguageSwitcher";

    if (isSpecial(draggedItem) || isSpecial(targetItem)) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
  };

  const handleFooterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!footerData || !over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const itemMatch = activeId.match(/^footer-col-(\d+)-item-(\d+)$/);
    if (itemMatch) {
      const colIndex = parseInt(itemMatch[1], 10);
      const overItemMatch = overId.match(/^footer-col-(\d+)-item-(\d+)$/);
      if (overItemMatch && parseInt(overItemMatch[1], 10) === colIndex) {
        const oldIndex = parseInt(itemMatch[2], 10);
        const newIndex = parseInt(overItemMatch[2], 10);
        reorderFooterColumnItems(colIndex, oldIndex, newIndex);
      }
      return;
    }

    const oldIndex = footerData.columns.findIndex((_, i) => `footer-col-${i}` === activeId);
    const newIndex = footerData.columns.findIndex((_, i) => `footer-col-${i}` === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newColumns = arrayMove(footerData.columns, oldIndex, newIndex);
      updateFooter({ columns: newColumns });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <IconRefresh className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || (!menuData && !yamlError)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load menu</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <IconArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <IconMenu2 className="h-5 w-5 text-primary" />
                {menuName}
              </h1>
              <p className="text-sm text-muted-foreground">Menu Editor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => handleLocaleSwitch("en")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  locale === "en"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
                data-testid="button-locale-en"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLocaleSwitch("es")}
                className={`px-3 py-1.5 text-sm font-medium border-l transition-colors ${
                  locale === "es"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
                data-testid="button-locale-es"
              >
                ES
              </button>
            </div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => setShowSourceSidebar(true)}
              data-testid="button-view-source"
            >
              <IconFileCode className="h-4 w-4 mr-2" />
              View Source
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending || !!yamlError}
              data-testid="button-save-menu"
            >
              {saveMutation.isPending ? (
                <IconRefresh className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <IconDeviceFloppy className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto">
          {yamlError && (
            <Card className="mb-6 border-destructive">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-destructive">
                  <IconCode className="h-5 w-5" />
                  <span className="font-medium">YAML Error</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-mono">{yamlError}</p>
              </CardContent>
            </Card>
          )}

          <MenuUsageInfo menuName={menuName} />

          {menuData && isNavbarMenu && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Menu Items ({menuData.navbar!.items.length})
                </h2>
                {isEnglish && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    data-testid="button-add-item"
                  >
                    <IconPlus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[calc(100vh-200px)]">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={menuData.navbar!.items.map((_, i) => `item-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {menuData.navbar!.items.map((item, index) => {
                      const isSpecialItem = item.component === "Logo" || item.component === "LanguageSwitcher";
                      return (
                        <SortableMenuItemEditor
                          key={`item-${index}`}
                          id={`item-${index}`}
                          item={item}
                          index={index}
                          onUpdate={handleUpdateItem}
                          onDelete={isEnglish && !isSpecialItem ? (idx) => setConfirmDeleteIndex(idx) : undefined}
                          isExpanded={expandedItems.has(index)}
                          onToggleExpand={toggleExpand}
                          isReadOnlyStructure={!isEnglish || isSpecialItem}
                          locale={locale}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
                {menuData.navbar!.items.length === 0 && isEnglish && (
                  <div className="text-center py-12">
                    <IconMenu2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No menu items yet</p>
                    <Button onClick={handleAddItem} data-testid="button-add-first-item">
                      <IconPlus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          {menuData && isFooterMenu && footerData && (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Footer Columns ({footerData.columns?.length || 0})
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFooterColumn}
                      data-testid="button-add-footer-column"
                    >
                      <IconPlus className="h-4 w-4 mr-2" />
                      Add Column
                    </Button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleFooterDragEnd}
                  >
                    <SortableContext
                      items={(footerData.columns || []).map((_, i) => `footer-col-${i}`)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-6 bg-popover border border-border rounded-lg">
                        {(footerData.columns || []).map((column, colIndex) => (
                          <SortableFooterColumn
                            key={`footer-col-${colIndex}`}
                            id={`footer-col-${colIndex}`}
                            column={column}
                            colIndex={colIndex}
                            isEnglish={isEnglish}
                            locale={locale}
                            onDeleteColumn={deleteFooterColumn}
                            onUpdateColumn={updateFooterColumn}
                            onUpdateColumnItem={updateFooterColumnItem}
                            onDeleteColumnItem={deleteFooterColumnItem}
                            onAddColumnItem={addFooterColumnItem}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Social Links ({footerData.socials?.length || 0})
                    </h2>
                    {isEnglish && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addFooterSocial}
                        data-testid="button-add-footer-social"
                      >
                        <IconPlus className="h-4 w-4 mr-2" />
                        Add Social
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(footerData.socials || []).map((social, index) => (
                      <Card key={index} className="p-3" data-testid={`footer-social-${index}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={social.name}
                                onChange={(e) => updateFooterSocial(index, { name: e.target.value })}
                                placeholder="Social name"
                                className="h-8 text-sm"
                                data-testid={`footer-social-${index}-name`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Icon</Label>
                              <Select
                                value={social.icon}
                                onValueChange={(icon) => updateFooterSocial(index, { icon })}
                              >
                                <SelectTrigger className="h-8 text-sm" data-testid={`footer-social-${index}-icon`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="linkedin">Linkedin</SelectItem>
                                  <SelectItem value="facebook">Facebook</SelectItem>
                                  <SelectItem value="x-logo">X (Twitter)</SelectItem>
                                  <SelectItem value="instagram">Instagram</SelectItem>
                                  <SelectItem value="youtube">YouTube</SelectItem>
                                  <SelectItem value="tiktok">TikTok</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">URL</Label>
                              <div className="relative">
                                <IconLink className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input
                                  value={social.link}
                                  onChange={(e) => updateFooterSocial(index, { link: e.target.value })}
                                  placeholder="https://..."
                                  className="h-8 text-sm pl-7"
                                  data-testid={`footer-social-${index}-link`}
                                />
                              </div>
                            </div>
                          </div>
                          {isEnglish && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteFooterSocial(index)}
                              className="text-destructive hover:text-destructive flex-shrink-0"
                              data-testid={`footer-social-${index}-delete`}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Legal Links ({footerData.legal_links?.length || 0})
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFooterLegalLink}
                      data-testid="button-add-footer-legal"
                    >
                      <IconPlus className="h-4 w-4 mr-2" />
                      Add Link
                    </Button>
                  </div>

                  <div className="p-4 bg-popover border border-border rounded-lg">
                    <ul className="space-y-1">
                      {(footerData.legal_links || []).map((link, index) => (
                        <li key={index}>
                          <EditableLinkItem
                            label={link.label || ""}
                            href={link.href || ""}
                            onLabelChange={(label) => updateFooterLegalLink(index, { label })}
                            onHrefChange={(href) => updateFooterLegalLink(index, { href })}
                            onSave={(label, href) => updateFooterLegalLink(index, { label, href })}
                            onDelete={() => deleteFooterLegalLink(index)}
                            testIdPrefix={`footer-legal-${index}`}
                            isReadOnlyStructure={false}
                            locale={locale}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">
                    Copyright Text
                  </h2>
                  <Input
                    value={footerData.copyright_text || ""}
                    onChange={(e) => updateFooter({ copyright_text: e.target.value })}
                    placeholder="2024 4Geeks Academy. All rights reserved."
                    data-testid="footer-copyright-input"
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          {menuData && !isNavbarMenu && !isFooterMenu && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  YAML Editor
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedText}
                    onClick={() => { activeEditorRef.current = "main"; setVarModalOpen(true); }}
                    data-testid="button-insert-variable-main"
                  >
                    <IconVariable className="h-4 w-4 mr-1" />
                    Convert to Variable
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Edit the menu content directly in YAML
                  </p>
                </div>
              </div>
              <div data-testid="codemirror-yaml-editor">
                <CodeMirror
                  ref={cmRef}
                  value={yamlSource}
                  height="calc(100vh - 250px)"
                  extensions={[yamlLang()]}
                  theme={oneDark}
                  onChange={(value) => handleYamlEdit(value)}
                  onUpdate={handleCmUpdate}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <Sheet open={showSourceSidebar} onOpenChange={setShowSourceSidebar}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col p-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <IconFileCode className="h-5 w-5 text-primary" />
              <span className="font-semibold">YAML Source</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedText}
                onClick={() => { activeEditorRef.current = "sidebar"; setVarModalOpen(true); }}
                data-testid="button-insert-variable-sidebar"
              >
                <IconVariable className="h-4 w-4 mr-1" />
                Convert to Variable
              </Button>
              {yamlError && (
                <span className="text-xs text-destructive">Invalid YAML</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden" data-testid="codemirror-yaml-source">
            <CodeMirror
              ref={cmSidebarRef}
              value={yamlSource}
              height="calc(100vh - 80px)"
              extensions={[yamlLang()]}
              theme={oneDark}
              onChange={(value) => handleYamlEdit(value)}
              onUpdate={handleCmUpdate}
            />
          </div>
        </SheetContent>
      </Sheet>

      <VariableDetailModal
        open={varModalOpen}
        onOpenChange={setVarModalOpen}
        variableName=""
        inlineDefault={selectedText}
        mode="create"
        onCreated={handleVariableCreated}
      />

      <Dialog open={confirmDeleteIndex !== null} onOpenChange={() => setConfirmDeleteIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Menu Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this menu item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteIndex(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteIndex !== null && handleDeleteItem(confirmDeleteIndex)}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingLocaleSwitch !== null} onOpenChange={() => setPendingLocaleSwitch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Language?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Switching languages will discard your changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLocaleSwitch(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLocaleSwitch}
              data-testid="button-confirm-locale-switch"
            >
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
