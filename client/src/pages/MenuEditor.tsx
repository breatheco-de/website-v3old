import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback } from "react";
import yaml from "js-yaml";
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
} from "@tabler/icons-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditableDropdownPreview } from "@/components/menus";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MenuItemData {
  label: string;
  href: string;
  component: string;
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

interface MenuData {
  navbar: {
    items: MenuItemData[];
  };
}

interface MenuResponse {
  name: string;
  data: MenuData;
  rawYaml?: string;
}

const componentOptions = [
  { value: "SimpleLink", label: "Simple Link" },
  { value: "Dropdown", label: "Dropdown Menu" },
];

const dropdownTypes = [
  { value: "cards", label: "Cards" },
  { value: "columns", label: "Columns" },
  { value: "simple-list", label: "Simple List" },
  { value: "grouped-list", label: "Grouped List" },
];

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
        </CardContent>
      )}
    </Card>
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
  
  const isEnglish = locale === "en";

  const parsedResult = useMemo<{ data: MenuData | null; error: string | null }>(() => {
    if (!yamlSource) return { data: null, error: null };
    try {
      const parsed = yaml.load(yamlSource) as MenuData;
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
      const newYaml = yaml.dump(newData, {
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
      const response = await fetch(`/api/menus/${menuName}?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load menu");
      return response.json();
    },
    enabled: !!menuName,
  });

  useEffect(() => {
    if (data?.data) {
      const initialYaml = yaml.dump(data.data, {
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
      const parsedData = yaml.load(yamlContent) as MenuData;
      
      // Use different endpoints based on locale:
      // - English: structure endpoint (propagates to all translations)
      // - Other locales: translations endpoint (text-only changes)
      if (isEnglish) {
        return apiRequest("PUT", `/api/menus/${menuName}/structure`, { data: parsedData });
      } else {
        return apiRequest("PUT", `/api/menus/${menuName}/translations?locale=${locale}`, { data: parsedData });
      }
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menus", menuName] });
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

  const handleUpdateItem = (index: number, updatedItem: MenuItemData) => {
    if (!menuData) return;
    const newItems = [...menuData.navbar.items];
    newItems[index] = updatedItem;
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
  };

  const handleDeleteItem = (index: number) => {
    if (!menuData) return;
    const newItems = menuData.navbar.items.filter((_, i) => i !== index);
    updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
    setConfirmDeleteIndex(null);
  };

  const handleAddItem = () => {
    if (!menuData) return;
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
    if (!menuData || !over || active.id === over.id) return;

    const oldIndex = menuData.navbar.items.findIndex((_, i) => `item-${i}` === active.id);
    const newIndex = menuData.navbar.items.findIndex((_, i) => `item-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(menuData.navbar.items, oldIndex, newIndex);
      updateYamlFromData({ ...menuData, navbar: { ...menuData.navbar, items: newItems } });
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

          {menuData && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Menu Items ({menuData.navbar.items.length})
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
                    items={menuData.navbar.items.map((_, i) => `item-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {menuData.navbar.items.map((item, index) => (
                      <SortableMenuItemEditor
                        key={`item-${index}`}
                        id={`item-${index}`}
                        item={item}
                        index={index}
                        onUpdate={handleUpdateItem}
                        onDelete={isEnglish ? (idx) => setConfirmDeleteIndex(idx) : undefined}
                        isExpanded={expandedItems.has(index)}
                        onToggleExpand={toggleExpand}
                        isReadOnlyStructure={!isEnglish}
                        locale={locale}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {menuData.navbar.items.length === 0 && isEnglish && (
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
              <span className="text-xs text-muted-foreground">
                Edit YAML directly
              </span>
              {yamlError && (
                <span className="text-xs text-destructive">Invalid YAML</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden" data-testid="codemirror-yaml-source">
            <CodeMirror
              value={yamlSource}
              height="calc(100vh - 80px)"
              extensions={[yamlLang()]}
              theme={oneDark}
              onChange={(value) => handleYamlEdit(value)}
            />
          </div>
        </SheetContent>
      </Sheet>

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
