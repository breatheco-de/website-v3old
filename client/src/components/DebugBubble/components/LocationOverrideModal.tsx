import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface LocationOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLocationSlug: string;
  setSelectedLocationSlug: (v: string) => void;
  currentLocationOverride: string | null;
  handleLocationOverride: () => void;
  handleClearLocationOverride: () => void;
  locationsByRegion: Record<string, Array<{slug: string; name: string; country: string; region: string}>>;
  regionLabels: Record<string, string>;
}

export function LocationOverrideModal(props: LocationOverrideModalProps) {
  const {
    open,
    onOpenChange,
    selectedLocationSlug,
    setSelectedLocationSlug,
    currentLocationOverride,
    handleLocationOverride,
    handleClearLocationOverride,
    locationsByRegion,
    regionLabels,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Session Location</DialogTitle>
          <DialogDescription>
            You can override the auto-detected location by adding a <code className="text-xs bg-muted px-1 py-0.5 rounded">?location=slug</code> query parameter to any URL. This is useful for testing location-specific content.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select new Location</label>
            <Select value={selectedLocationSlug} onValueChange={setSelectedLocationSlug}>
              <SelectTrigger data-testid="select-location-override">
                <SelectValue placeholder="Choose a location..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(locationsByRegion).map(([region, locs]) => (
                  <SelectGroup key={region}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">
                      {regionLabels[region] || region}
                    </SelectLabel>
                    {locs.map((loc) => (
                      <SelectItem key={loc.slug} value={loc.slug}>
                        {loc.name}, {loc.country}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {currentLocationOverride && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Currently overriding:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{currentLocationOverride}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLocationOverride}
                className="h-6 px-2 text-xs"
                data-testid="button-clear-location-override"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-location-override"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLocationOverride}
            disabled={!selectedLocationSlug}
            data-testid="button-confirm-location-override"
          >
            Override Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
