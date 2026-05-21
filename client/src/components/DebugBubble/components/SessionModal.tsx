import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: any;
  hasToken: boolean;
  getDebugToken: () => string | null;
  getDebugUserName: () => string | null;
  clearToken: () => void;
}

export function SessionModal(props: SessionModalProps) {
  const {
    open,
    onOpenChange,
    session,
    hasToken,
    getDebugToken,
    getDebugUserName,
    clearToken,
  } = props;

  const [tokenCopied, setTokenCopied] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session Data{getDebugUserName() ? ` - ${getDebugUserName()}` : ''}</DialogTitle>
          <DialogDescription>
            Current session values captured from browser, geolocation, and URL parameters.
            {hasToken && getDebugToken() && (
              <>
                {" "}
                <button
                  onClick={() => { clearToken(); onOpenChange(false); }}
                  className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                  data-testid="link-logout"
                >
                  logout
                </button>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {hasToken && getDebugToken() && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Authentication Token</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-2 py-1.5 rounded text-xs font-mono truncate" data-testid="text-session-token">
                  {getDebugToken()}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => {
                    const token = getDebugToken();
                    if (token) {
                      navigator.clipboard.writeText(token);
                      setTokenCopied(true);
                      setTimeout(() => setTokenCopied(false), 2000);
                    }
                  }}
                  data-testid="button-copy-token"
                >
                  {tokenCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
          
          <div className={`space-y-3 ${hasToken && getDebugToken() ? 'border-t pt-3' : ''}`}>
            <h4 className="text-sm font-semibold text-foreground">Geolocation</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.country || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">City:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.city || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.region || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timezone:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.geo?.timezone || 'N/A'}</code>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Device</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.deviceCategory || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OS:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.osFamily || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Browser:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.browserFamily || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Viewport:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.viewportWidth}x{session.device?.viewportHeight}</code>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Pixel Ratio:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.device?.devicePixelRatio || 'N/A'}</code>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">UTM Parameters</h4>
            <div className="space-y-1.5 text-sm">
              {(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement', 'utm_plan'] as const).map(key => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{key}:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.[key] || '—'}</code>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t pt-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Tracking</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PPC Tracking ID:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs max-w-[150px] truncate">{session.utm?.ppc_tracking_id || '—'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referral:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.referral || session.utm?.ref || '—'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coupon:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.utm?.coupon || '—'}</code>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-3 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Session Info</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.language}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Browser Lang:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.browserLang || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location Campus:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.location?.slug || 'N/A'}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initialized:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{session.initialized ? 'Yes' : 'No'}</code>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-session-modal"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
