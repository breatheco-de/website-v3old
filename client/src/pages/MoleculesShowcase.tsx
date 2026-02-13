import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoleculeRenderer, type MoleculeDefinition } from "@/components/MoleculeRenderer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IconAtom, IconX, IconTag, IconBox, IconCode } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";

interface MoleculesData {
  molecules: MoleculeDefinition[];
}

export default function MoleculesShowcase() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery<MoleculesData>({
    queryKey: ["/api/molecules"],
  });

  const allTags = useMemo(() => {
    if (!data?.molecules) return [];
    const tagSet = new Set<string>();
    data.molecules.forEach((m) => m.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [data]);

  const allComponents = useMemo(() => {
    if (!data?.molecules) return [];
    const componentSet = new Set<string>();
    data.molecules.forEach((m) => componentSet.add(m.component));
    return Array.from(componentSet).sort();
  }, [data]);

  const filteredMolecules = useMemo(() => {
    if (!data?.molecules) return [];
    let filtered = data.molecules;
    if (selectedTags.length > 0) {
      filtered = filtered.filter((m) =>
        selectedTags.some((tag) => m.tags.includes(tag))
      );
    }
    if (selectedComponents.length > 0) {
      filtered = filtered.filter((m) =>
        selectedComponents.includes(m.component)
      );
    }
    return filtered;
  }, [data, selectedTags, selectedComponents]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleComponent = (component: string) => {
    setSelectedComponents((prev) =>
      prev.includes(component) ? prev.filter((c) => c !== component) : [...prev, component]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedComponents([]);
  };

  const hasActiveFilters = selectedTags.length > 0 || selectedComponents.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Loading molecules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load molecules data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <IconAtom className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Molecules Showcase
              </h1>
              <p className="text-sm text-muted-foreground">
                Showing {filteredMolecules.length} of {data?.molecules.length || 0} molecules
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="button-open-tag-filter"
                  >
                    <IconTag className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter by Tags</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {allTags.map((tag) => (
                      <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTag(tag)}
                        data-testid={`button-modal-filter-tag-${tag}`}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
              {selectedTags.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">All tags</span>
              ) : (
                selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                    data-testid={`badge-active-tag-${tag}`}
                  >
                    {tag}
                    <IconX className="w-3 h-3 ml-1" />
                  </Badge>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="button-open-component-filter"
                  >
                    <IconBox className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter by Component</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {allComponents.map((component) => (
                      <Button
                        key={component}
                        variant={selectedComponents.includes(component) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleComponent(component)}
                        data-testid={`button-modal-filter-component-${component}`}
                      >
                        {component}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
              {selectedComponents.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">All components</span>
              ) : (
                selectedComponents.map((component) => (
                  <Badge
                    key={component}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => toggleComponent(component)}
                    data-testid={`badge-active-component-${component}`}
                  >
                    {component}
                    <IconX className="w-3 h-3 ml-1" />
                  </Badge>
                ))
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                <IconX className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMolecules.map((molecule) => (
            <div key={molecule.id} data-testid={`molecule-${molecule.id}`}>
              <Card>
                <CardHeader className="pl-[14px] pr-[14px] pt-[4px] pb-[4px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg">{molecule.component} → {molecule.variant}</CardTitle>
                    <div className="flex items-center">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7 px-2"
                            data-testid={`button-tags-${molecule.id}`}
                          >
                            <IconTag className="w-3 h-3" />
                            {molecule.tags.length}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3">
                          <div className="flex flex-wrap gap-1">
                            {molecule.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            data-testid={`button-props-${molecule.id}`}
                          >
                            <IconCode className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0">
                          <CodeMirror
                            value={JSON.stringify(molecule.props, null, 2)}
                            extensions={[json()]}
                            theme={oneDark}
                            editable={false}
                            basicSetup={{ lineNumbers: false, foldGutter: false }}
                            className="text-xs max-h-64 overflow-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {molecule.description && (
                    <p className="text-sm text-muted-foreground">
                      {molecule.description}
                    </p>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <MoleculeRenderer molecule={molecule} />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {filteredMolecules.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              No molecules match the selected filters
            </p>
            <Button
              variant="outline"
              onClick={clearFilters}
              className="mt-4"
              data-testid="button-clear-filters-empty"
            >
              Clear filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
