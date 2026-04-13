export const variant = "textOnly";

import type { FeaturesGridTextOnlySection, FeaturesGridTextOnlyItem } from "@shared/schema";
import { Card } from "@/components/ui/card";

function TextOnlyCard({ item }: { item: FeaturesGridTextOnlyItem }) {
  const itemId = item.id || (item.headline || 'item').toLowerCase().replace(/\s+/g, '-');

  return (
    <Card 
      className="p-5 md:p-6 shadow-sm border border-border/50 hover:shadow-md hover:border-border transition-all duration-200 text-center"
      data-testid={`card-feature-${itemId}`}
    >
      <h3 className="font-semibold text-lg text-primary leading-tight mb-1 text-center">
        {item.headline}
      </h3>
      {item.subline && (
        <p className="text-base text-foreground leading-snug mb-2 text-center">
          {item.subline}
        </p>
      )}
      {item.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mt-3 text-center">
          {item.description}
        </p>
      )}
    </Card>
  );
}

interface FeaturesGridTextOnlyProps {
  data: FeaturesGridTextOnlySection;
}

export default function FeaturesGridTextOnly({ data }: FeaturesGridTextOnlyProps) {
  const columns = data.columns || 4;
  
  const gridColsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }[columns] || "md:grid-cols-2 lg:grid-cols-4";

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
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 ${gridColsClass} gap-5`}>
          {(data.items || []).map((item, index) => (
            <TextOnlyCard key={item.id || index} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
