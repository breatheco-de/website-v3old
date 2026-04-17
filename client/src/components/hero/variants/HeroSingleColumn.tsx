
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import UniversalImage from "@/components/UniversalImage";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { IconStarFilled, IconStar } from "@tabler/icons-react";
import type { HeroSingleColumn } from "@shared/schema";
import { createElement } from "react";
import { getIcon } from "@/lib/icons";
import { useInternalNav } from "@/hooks/useInternalNav";

const BLOG_IMAGE_FALLBACK = "https://storage.googleapis.com/4geeks-academy-website/media/Group-original_1765419144159.webp";

const DEFAULT_AVATAR_IDS = [
  "woman-profile-headshot-1-608aff01",
  "man-profile-headshot-1-0850c276",
  "woman-profile-headshot-2-a0ea2c29",
  "man-profile-headshot-2-516b72e4",
];

interface HeroSingleColumnProps {
  data: HeroSingleColumn;
}

export default function HeroSingleColumn({ data }: HeroSingleColumnProps) {
  const avatarIds = data.trust_bar?.avatars?.length ? data.trust_bar.avatars : DEFAULT_AVATAR_IDS;
  const handleLinkClick = useInternalNav();

  const [fallbackSrc, setFallbackSrc] = useState<string | undefined>();

  const rawSrc = data.image?.src !== "undefined" ? data.image?.src : undefined;
  const imgSrc = fallbackSrc ?? rawSrc ?? (data as any).image_id;

  const handleHeroError = () => {
    setFallbackSrc(data.image?.fallback ?? BLOG_IMAGE_FALLBACK);
  };

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
          dangerouslySetInnerHTML={{ __html: data.title || "" }}
        />
        
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
              {avatarIds.map((avatarId, index) => (
                <Avatar 
                  key={index} 
                  className="h-8 w-8 border-2 border-background"
                >
                  <UniversalImage
                    id={avatarId}
                    alt={`Student ${index + 1}`}
                    className="h-full w-full"
                    style={{ objectFit: "cover" }}
                  />
                </Avatar>
              ))}
            </div>

            <div className="flex flex-col items-start gap-0.5">
              {data.trust_bar.rating && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{data.trust_bar.rating || ""}</span>
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
                  {button.icon && (() => { const Ic = getIcon(button.icon); return Ic ? createElement(Ic, { className: "h-4 w-4" }) : null; })()}
                  {button.text}
                </a>
              </Button>
            ))}
          </div>
        )}

      </div>
      {imgSrc && (
        <div className={data.image_full_width ? "w-full mt-8" : "max-w-6xl mx-auto px-4 mt-8 flex justify-center"}>
          <UniversalImage
            key={imgSrc}
            id={imgSrc}
            alt={data.image?.alt || ""}
            preset="hero-wide"
            className={`w-full rounded-none ${data.image_full_width ? "max-h-[250px]" : ""}`}
            style={{
              width: data.image_width || '100%',
              ...(data.image_full_width ? {} : { borderRadius: '0.8rem' }),
            }}
            onError={handleHeroError}
            data-testid="img-hero-single-column"
            fieldContext={(data as any).image_id ? { fieldPath: "image_id" } : undefined}
          />
        </div>
      )}
    </section>
  );
}
