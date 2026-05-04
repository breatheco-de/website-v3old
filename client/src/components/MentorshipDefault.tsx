import { Card, CardContent } from "@/components/ui/card";
import * as LucideIcons from "lucide-react";
import type { MentorshipSection as MentorshipSectionType } from "@shared/schema";
import type { ComponentType } from "react";

interface MentorshipSectionProps {
  data: MentorshipSectionType;
}

export default function MentorshipDefault({ data }: MentorshipSectionProps) {
  const getIcon = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, ComponentType<{ size?: number; className?: string }>>;
    const IconComponent = icons[(iconName).charAt(0).toUpperCase() + (iconName).slice(1) as keyof typeof LucideIcons];
    return IconComponent ? <IconComponent size={32} className="text-primary" /> : null;
  };

  return (
    <section 
      className="bg-background"
      data-testid="section-mentorship"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4 text-foreground"
            data-testid="text-mentorship-title"
          >
            {data.title}
          </h2>
          {data.subtitle && (
            <p 
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
              data-testid="text-mentorship-subtitle"
            >
              {data.subtitle}
            </p>
          )}
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {(data.cards || []).map((card, index) => (
            <Card 
              key={index} 
              className="text-center p-6 hover-elevate"
              data-testid={`card-mentorship-${index}`}
            >
              <CardContent className="pt-6">
                <div className="flex justify-center mb-4">
                  {getIcon(card.icon)}
                </div>
                <h3 
                  className="text-xl font-semibold mb-2 text-foreground"
                  data-testid={`text-mentorship-card-title-${index}`}
                >
                  {card.title}
                </h3>
                <p 
                  className="text-muted-foreground"
                  data-testid={`text-mentorship-card-desc-${index}`}
                >
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
