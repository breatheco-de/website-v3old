import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UniversalImage } from "@/components/UniversalImage";
import { RichTextContent } from "@/components/ui/rich-text-content";
import * as TablerIcons from "@tabler/icons-react";
import { IconStarFilled, IconStar } from "@tabler/icons-react";
import type { HeroSingleColumn } from "@shared/schema";
import type { ComponentType } from "react";
import { useInternalNav } from "@/hooks/useInternalNav";
import { resolveTemplateFallback } from "@/lib/variable-resolver";
import avatar1 from "@assets/generated_images/Woman_profile_headshot_1_608aff01.webp";
import avatar2 from "@assets/generated_images/Man_profile_headshot_1_0850c276.webp";
import avatar3 from "@assets/generated_images/Woman_profile_headshot_2_a0ea2c29.webp";
import avatar4 from "@assets/generated_images/Man_profile_headshot_2_516b72e4.webp";

interface HeroSingleColumnProps {
  data: HeroSingleColumn;
}

export function HeroSingleColumn({ data }: HeroSingleColumnProps) {
  const getIcon = (iconName: string) => {
    const icons = TablerIcons as unknown as Record<string, ComponentType<{ size?: number }>>;
    const IconComponent = icons[`Icon${iconName}`];
    return IconComponent ? <IconComponent size={20} /> : null;
  };

  const avatars = [avatar1, avatar2, avatar3, avatar4];
  const handleLinkClick = useInternalNav();

  return (
    <section 
      data-testid="section-hero"
    >
      <div className="max-w-6xl mx-auto px-4 text-center">
        {data.badge && (
          <Badge 
            variant="secondary" 
            className="mb-6"
            data-testid="badge-hero"
          >
            {data.badge}
          </Badge>
        )}
        
        <h1 
          className="text-4xl md:text-h1 mb-6 text-foreground"
          data-testid="text-hero-title"
        >
          {data.title}
        </h1>
        
        {data.subtitle && (
          <RichTextContent 
            html={data.subtitle}
            className="text-body text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed [&_p]:mb-0"
            data-testid="text-hero-subtitle"
          />
        )}

        {data.trust_bar && (
          <div 
            className="flex items-center justify-center gap-3 mb-8"
            data-testid="trust-bar"
          >
            <div className="flex -space-x-2">
              {avatars.map((avatar, index) => (
                <Avatar 
                  key={index} 
                  className="h-8 w-8 border-2 border-background"
                >
                  <AvatarImage src={avatar} alt={`Student ${index + 1}`} />
                  <AvatarFallback className="bg-primary/20 text-xs">
                    {String.fromCharCode(65 + index)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>

            <div className="flex flex-col items-start gap-0.5">
              {data.trust_bar.rating && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{resolveTemplateFallback(data.trust_bar.rating || "")}</span>
                  <div className="flex">
                    {[1, 2, 3, 4].map((i) => (
                      <IconStarFilled
                        key={i}
                        className="text-yellow-500 w-4 h-4"
                      />
                    ))}
                    <IconStar className="text-yellow-500 w-4 h-4" />
                  </div>
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {data.trust_bar.trusted_text}
              </span>
            </div>
          </div>
        )}
        
        {data.cta_buttons && data.cta_buttons.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {data.cta_buttons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant === "primary" ? "default" : button.variant}
                size="lg"
                asChild
                data-testid={`button-hero-cta-${index}`}
              >
                <a href={button.url} onClick={handleLinkClick} className="flex items-center gap-2">
                  {button.icon && getIcon(button.icon)}
                  {button.text}
                </a>
              </Button>
            ))}
          </div>
        )}

      </div>

      {data.image_id && (
        <div className={data.image_full_width ? "w-full mt-8 object-cover" : "max-w-6xl mx-auto px-4 mt-8 flex justify-center"}>
          <UniversalImage
            id={data.image_id}
            alt=""
            className={`h-auto object-cover rounded-none ${data.image_full_width ? "max-h-[250px]" : ""}`}
            style={{
              width: data.image_width || '100%',
              ...(data.image_full_width ? {} : { borderRadius: '0.8rem' }),
            }}
            data-testid="img-hero-single-column"
          />
        </div>
      )}
    </section>
  );
}
