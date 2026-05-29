import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BankTestimonial {
  student_name: string;
  student_thumb?: string;
  student_video?: string;
  excerpt?: string;
  full_text?: string;
  content?: string;
  short_content?: string;
  related_features?: string[];
  priority?: number;
  rating?: number;
  role?: string;
  company?: string;
}

interface TestimonialItemsPreviewProps {
  relatedFeatures: string[];
  itemStyles?: Record<string, { box_color?: string; name_color?: string; comment_color?: string }>;
  locale: string;
  onUpdateItemStyle?: (studentName: string, prop: string, value: string) => void;
  readOnly?: boolean;
}

const ANONYMOUS_NAMES = ["anonymous", "anonimous", "anónimo", "anonimo", "anon"];

function isAnonymous(name: string): boolean {
  return ANONYMOUS_NAMES.includes(name.trim().toLowerCase());
}

function isValidTestimonial(t: BankTestimonial): boolean {
  if (isAnonymous(t.student_name)) return false;
  const hasText = !!(t.excerpt || t.short_content || t.content || t.full_text);
  return hasText;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TestimonialItemsPreview({
  relatedFeatures,
  itemStyles = {},
  locale,
  onUpdateItemStyle,
  readOnly = false,
}: TestimonialItemsPreviewProps) {
  const { data: bankData, isLoading } = useQuery<{ testimonials: BankTestimonial[] }>({
    queryKey: ["/api/testimonials", locale],
    staleTime: 5 * 60 * 1000,
  });

  const filteredItems = (() => {
    const all = (bankData?.testimonials ?? []).filter(isValidTestimonial);
    if (relatedFeatures.length === 0) {
      return all.slice(0, 30);
    }
    return all
      .filter((t) => {
        const features = t.related_features || [];
        return relatedFeatures.some((f) => features.includes(f));
      })
      .sort((a, b) => {
        const aPriority5 = (a.priority ?? 0) >= 5 ? 1 : 0;
        const bPriority5 = (b.priority ?? 0) >= 5 ? 1 : 0;
        if (bPriority5 !== aPriority5) return bPriority5 - aPriority5;
        const aHasVideo = a.student_video ? 1 : 0;
        const bHasVideo = b.student_video ? 1 : 0;
        if (bHasVideo !== aHasVideo) return bHasVideo - aHasVideo;
        const aHasThumb = a.student_thumb ? 1 : 0;
        const bHasThumb = b.student_thumb ? 1 : 0;
        if (bHasThumb !== aHasThumb) return bHasThumb - aHasThumb;
        return (b.priority ?? 0) - (a.priority ?? 0);
      })
      .slice(0, 30);
  })();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Items ({0})</Label>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Items (0)</Label>
        <p className="text-xs text-muted-foreground">
          {locale === "es"
            ? "No se encontraron testimonios para los topics seleccionados."
            : "No testimonials found for the selected topics."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Items ({filteredItems.length})</Label>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {filteredItems.map((item) => (
          <TestimonialItemRow
            key={item.student_name}
            item={item}
            style={itemStyles[item.student_name]}
            locale={locale}
            onUpdateStyle={(prop, value) => onUpdateItemStyle?.(item.student_name, prop, value)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

interface TestimonialItemRowProps {
  item: BankTestimonial;
  style?: { box_color?: string; name_color?: string; comment_color?: string };
  locale: string;
  onUpdateStyle: (prop: string, value: string) => void;
  readOnly?: boolean;
}

function TestimonialItemRow({ item, style, locale, onUpdateStyle, readOnly = false }: TestimonialItemRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const text = item.excerpt || item.short_content || item.content || item.full_text || "";
  const hasCustomStyle = !readOnly && (style?.box_color || style?.name_color || style?.comment_color);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full" asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full p-2 rounded-md bg-muted/50 hover:bg-muted/80 transition-colors text-left"
          data-testid={`testimonial-item-${item.student_name}`}
        >
          <Avatar className="w-7 h-7 flex-shrink-0">
            {item.student_thumb && <AvatarImage src={item.student_thumb} alt={item.student_name} />}
            <AvatarFallback className="bg-foreground/10 text-foreground/70 text-[10px] font-semibold">
              {getInitials(item.student_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{item.student_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {item.role || ""}
              {item.company ? ` - ${item.company}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.rating && (
              <div className="flex items-center gap-0.5">
                <Star className="fill-current w-3 h-3 text-yellow-500" />
                <span className="text-[10px] text-muted-foreground">{item.rating}</span>
              </div>
            )}
            {hasCustomStyle && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-11 pr-2 py-2 space-y-3">
          {text && (
            <p className="text-[11px] text-muted-foreground line-clamp-3 italic">&ldquo;{text}&rdquo;</p>
          )}
          {!readOnly && (
            <div className="space-y-2">
              <ColorPicker
                value={style?.box_color || ""}
                onChange={(value) => onUpdateStyle("box_color", value)}
                type="background"
                label={locale === "es" ? "Fondo" : "Background"}
                testIdPrefix={`testimonial-${item.student_name}-box`}
              />
              <ColorPicker
                value={style?.name_color || ""}
                onChange={(value) => onUpdateStyle("name_color", value)}
                type="text"
                label={locale === "es" ? "Color de nombre" : "Name color"}
                testIdPrefix={`testimonial-${item.student_name}-name`}
              />
              <ColorPicker
                value={style?.comment_color || ""}
                onChange={(value) => onUpdateStyle("comment_color", value)}
                type="text"
                label={locale === "es" ? "Color de texto" : "Text color"}
                testIdPrefix={`testimonial-${item.student_name}-comment`}
              />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
