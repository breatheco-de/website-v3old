
import { useState } from "react";
import type { FeaturesGridDetailedSection, FeaturesGridDetailedItem } from "@shared/schema";
import { Card } from "@/components/ui/card";
import * as TablerIcons from "@tabler/icons-react";
import { getCustomIcon } from "@/components/custom-icons";
import type { ComponentType } from "react";
import { AIWorkflowDiagram } from "@/components/AIWorkflowDiagram";
import { useInternalNav } from "@/hooks/useInternalNav";

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

function DetailedCard({ 
  item, 
  collapsible,
  iconColor
}: { 
  item: FeaturesGridDetailedItem; 
  collapsible: boolean;
  iconColor?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const handleLinkClick = useInternalNav();
  const itemId = item.id || item.title.toLowerCase().replace(/\s+/g, '-');
  const hasImage = item.image?.src;
  
  return (
    <Card className="p-4 md:p-6 hover-elevate" data-testid={`card-feature-${itemId}`}>
      {hasImage && (
        <div className="mb-4 flex items-center justify-center h-32 md:h-40">
          <img 
            src={item.image!.src} 
            alt={item.image!.alt} 
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            data-testid={`img-feature-${itemId}`}
          />
        </div>
      )}
      <div 
        className={`flex justify-between items-start ${collapsible ? 'cursor-pointer md:cursor-default' : ''}`}
        onClick={() => collapsible && setIsOpen(!isOpen)}
        data-testid={`button-toggle-feature-${itemId}`}
      >
        <div className="flex-1">
          {item.category && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {item.category}
              </span>
              {!hasImage && item.icon && (
                <span className="w-4 h-4 md:w-5 md:h-6 flex-shrink-0 text-primary">
                  {getIcon(item.icon, "w-full h-full", "hsl(var(--primary))")}
                </span>
              )}
            </div>
          )}
          <h3 className={`text-lg md:text-xl font-bold text-foreground ${item.category ? 'mt-1' : ''}`}>
            {item.title}
          </h3>
        </div>
        {collapsible && (
          <TablerIcons.IconChevronDown 
            className={`md:hidden w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 self-start mt-1 ml-2 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </div>
      
      {collapsible && (
        <div className={`md:hidden overflow-hidden transition-all duration-brand ease-brand ${isOpen ? 'max-h-96 mt-4' : 'max-h-0'}`}>
          <p className="text-muted-foreground mb-4">
            {item.description}
          </p>
          {item.link_url && (
            <a 
              href={item.link_url}
              onClick={handleLinkClick}
              className="text-primary hover:underline font-medium"
              data-testid={`link-feature-mobile-${itemId}`}
            >
              {item.link_text || "Read More"}
            </a>
          )}
        </div>
      )}
      
      <div className={collapsible ? "hidden md:block mt-4" : "mt-4"}>
        <p className="text-muted-foreground mb-4">
          {item.description}
        </p>
        {item.link_url && (
          <a 
            href={item.link_url}
            onClick={handleLinkClick}
            className="text-primary hover:underline font-medium"
            data-testid={`link-feature-${itemId}`}
          >
            {item.link_text || "Read More"}
          </a>
        )}
      </div>
    </Card>
  );
}

interface FeaturesGridDetailedProps {
  data: FeaturesGridDetailedSection;
}

export default function FeaturesGridDetailed({ data }: FeaturesGridDetailedProps) {
  const columns = data.columns || 3;
  const collapsible = data.collapsible_mobile ?? true;
  
  const gridColsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns] || "md:grid-cols-3";

  return (
    <section 
      className={`${data.background || ''}`}
      data-testid="section-features-grid"
    >
      <div className="max-w-6xl mx-auto px-4">
        {(data.title || data.subtitle) && (
          <div className="text-center mb-6">
            {data.title && (
              <h2 
                className="text-h2 mb-4 text-foreground"
                data-testid="text-features-grid-title"
              >
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p className="text-body text-muted-foreground">
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 ${gridColsClass} gap-6`}>
          {data.items.map((item, index) => (
            <DetailedCard 
              key={item.id || index} 
              item={item} 
              collapsible={collapsible}
              iconColor={item.icon_color || data.icon_color}
            />
          ))}
        </div>

        {data.show_workflow_diagram && (
          <div className="mt-8 mx-auto w-[50%]">
            <AIWorkflowDiagram centerLabel={data.workflow_diagram_label} />
          </div>
        )}
      </div>
    </section>
  );
}
