
import type { FeaturesGridHighlightSection, FeaturesGridHighlightItem } from "@shared/schema";
import { Card } from "@/components/ui/card";
import * as TablerIcons from "@tabler/icons-react";
import { getCustomIcon } from "@/components/custom-icons";
import type { ComponentType } from "react";
import { RichTextContent } from "@/components/ui/rich-text-content";

function getIcon(iconName: string, className?: string, color?: string) {
  const CustomIcon = getCustomIcon(iconName);
  if (CustomIcon) {
    return <CustomIcon width="100%" height="100%" color={color} className={className} />;
  }
  
  // Handle both "IconRocket" and "Rocket" formats
  const tablerName = iconName.startsWith("Icon") ? iconName : `Icon${iconName}`;
  const IconComponent = TablerIcons[tablerName as keyof typeof TablerIcons] as ComponentType<{ className?: string; style?: React.CSSProperties }>;
  if (IconComponent) {
    const style = color ? { color } : undefined;
    return <IconComponent className={className || "w-full h-full text-primary"} style={style} />;
  }
  const style = color ? { color } : undefined;
  return <TablerIcons.IconBox className={className || "w-full h-full text-primary"} style={style} />;
}

function HighlightCard({ item, iconColor }: { item: FeaturesGridHighlightItem; iconColor?: string }) {
  const itemId = item.id || item.title.toLowerCase().replace(/\s+/g, '-');
  const hasValue = Boolean(item.value);
  const hasDescription = Boolean(item.description);
  
  const hasDescriptionNoValue = hasDescription && !hasValue;
  
  if (hasDescriptionNoValue) {
    return (
      <Card 
        className="p-4 md:p-6 shadow-sm"
        data-testid={`card-feature-${itemId}`}
      >
        <div className="flex items-start gap-4 md:hidden">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {getIcon(item.icon, "w-6 h-6", iconColor || "hsl(var(--primary))")}
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">
              {item.title}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {item.description}
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            {getIcon(item.icon, "w-6 h-6", iconColor || "hsl(var(--primary))")}
          </div>
          <div className="font-semibold text-foreground text-lg">
            {item.title}
          </div>
          <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {item.description}
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      className="p-4 md:p-6 flex items-center gap-4 md:gap-5 shadow-sm transition-transform duration-200 hover:scale-105"
      data-testid={`card-feature-${itemId}`}
    >
      <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg bg-primary/10 flex items-center justify-center">
        {getIcon(item.icon, "w-6 h-6 md:w-8 md:h-8", iconColor || "hsl(var(--primary))")}
      </div>
      <div>
        {item.value && (
          <div className="text-xl md:text-4xl font-semibold text-foreground">
            {item.value}
          </div>
        )}
        <div className={`font-semibold text-foreground ${item.value ? 'text-sm md:text-base mt-0.5 md:mt-1' : 'text-lg'}`}>
          {item.title}
        </div>
        {item.description && (
          <div className="text-sm text-muted-foreground mt-1">
            {item.description}
          </div>
        )}
      </div>
    </Card>
  );
}

interface FeaturesGridHighlightProps {
  data: FeaturesGridHighlightSection;
}

export default function FeaturesGridHighlight({ data }: FeaturesGridHighlightProps) {
  const columns = data.columns || 3;
  
  const gridColsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns] || "md:grid-cols-3";

  return (
    <section 
      className={`py-14 ${data.background || ''}`}
      data-testid="section-features-grid"
    >
      <div className="max-w-6xl mx-auto px-4">
        {(data.title || data.subtitle) && (
          <div className="text-center mb-8">
            {data.title && (
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4 text-foreground"
                data-testid="text-features-grid-title"
              >
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <RichTextContent
                html={data.subtitle}
                className="text-lg text-muted-foreground max-w-3xl mx-auto [&_p]:mb-0"
                data-testid="text-features-grid-subtitle"
              />
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 ${gridColsClass} gap-6`}>
          {(data.items || []).map((item, index) => (
            <HighlightCard key={item.id || index} item={item} iconColor={item.icon_color || data.icon_color} />
          ))}
        </div>

        {(data.footer_link || data.footer_note) && (
          <div className="text-center mt-8">
            {data.footer_link && (
              <a 
                href={data.footer_link.url}
                className="text-foreground underline font-medium italic"
                data-testid="link-features-grid-footer"
              >
                {data.footer_link.text}
              </a>
            )}
            {data.footer_note && (
              <p 
                className="text-sm text-muted-foreground mt-1"
                data-testid="text-features-grid-footer-note"
              >
                {data.footer_note}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
