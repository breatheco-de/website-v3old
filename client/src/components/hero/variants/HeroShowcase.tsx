
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { IconStarFilled, IconStar } from "@tabler/icons-react";
import type { HeroShowcase } from "@shared/schema";
import UniversalImage from "@/components/UniversalImage";
import { useInternalNav } from "@/hooks/useInternalNav";

const DEFAULT_AVATAR_IDS = [
  "woman-profile-headshot-1-608aff01",
  "man-profile-headshot-1-0850c276",
  "woman-profile-headshot-2-a0ea2c29",
  "man-profile-headshot-2-516b72e4",
];

interface HeroShowcaseProps {
  data: HeroShowcase;
}

export default function HeroShowcase({ data }: HeroShowcaseProps) {
  const avatarIds = data.trust_bar?.avatars?.length ? data.trust_bar.avatars : DEFAULT_AVATAR_IDS;
  const handleLinkClick = useInternalNav();

  return (
    <section className="container mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-8 items-start max-w-7xl mx-auto">
        {/* Left Images Column */}
        <div className="relative h-[300px] lg:h-[500px] hidden lg:block">
          {data.left_images?.map((image, index) => (
            <div
              key={index}
              className={`absolute w-56 transform transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] z-30 ${
                index === 0 
                  ? "top-[94px] left-0 -rotate-6" 
                  : "top-[222px] left-[100px] rotate-3"
              }`}
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
            >
              <UniversalImage
                id={image.src}
                alt={image.alt}
                className="w-full h-48 rounded-lg"
                style={{ objectFit: "cover" }}
                fieldContext={{ arrayPath: "left_images", index, srcField: "src" }}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* Content Column (Center) */}
        <div className="z-10 text-center md:px-4">
          <h1 
            className="text-5xl md:text-h1 mb-6 lg:-mx-32 min-[1280px]:-mx-0 min-[1280px]:whitespace-nowrap"
            data-testid="text-hero-title"
          >
            {data.title}
          </h1>

          {data.subtitle && (
            <p 
              className="text-body text-muted-foreground mb-6 max-w-2xl md:max-w-xl mx-auto"
              data-testid="text-hero-subtitle"
            >
              {data.subtitle}
            </p>
          )}

          {/* Trust Bar / Ratings */}
          {data.trust_bar && (
            <div className="flex items-center justify-center gap-3 mb-8" data-testid="trust-bar">
              <div className="flex -space-x-2">
                {avatarIds.map((avatarId, index) => (
                  <Avatar key={index} className="h-8 w-8 border-2 border-background">
                    <UniversalImage
                      id={avatarId}
                      alt={`User ${index + 1}`}
                      className="h-full w-full"
                      style={{ objectFit: "cover" }}
                    />
                  </Avatar>
                ))}
              </div>

              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{data.trust_bar.rating || ""}</span>
                  <div className="flex">
                    {[1, 2, 3, 4].map((i) => (
                      <IconStarFilled
                        key={i}
                        className="text-yellow-500 w-5 h-5"
                      />
                    ))}
                    {/* Partially filled star for decimal rating (e.g., 4.9 = 90% filled) */}
                    <div className="relative w-5 h-5">
                      <IconStar className="absolute text-yellow-500 w-5 h-5" />
                      <div className="absolute overflow-hidden" style={{ width: '90%' }}>
                        <IconStarFilled className="text-yellow-500 w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {data.trust_bar.trusted_text}
                </span>
              </div>
            </div>
          )}

          {/* Curved arrow */}
          {data.show_arrow && (
            <div className="hidden lg:flex justify-center mb-4">
              <UniversalImage
                id="curved-arrow-with-loop-1763159963338"
                alt="Arrow pointing to CTA"
                className="w-24 h-auto opacity-80"
                style={{ objectFit: "contain" }}
              />
            </div>
          )}

          {/* CTA Button */}
          <div>
            <Button
              size="lg"
              className="text-body px-8 mb-1 text-primary-foreground"
              asChild
              data-testid="button-hero-cta"
            >
              <a href={data.cta_button.url} onClick={handleLinkClick}>
                {data.cta_button.text}
              </a>
            </Button>
          </div>
        </div>

        {/* Right Images Column */}
        <div className="relative h-[300px] lg:h-[500px] hidden lg:block">
          {data.right_images?.map((image, index) => (
            <div
              key={index}
              className={`absolute w-56 transform transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] ${
                index === 0 
                  ? "top-[94px] right-0 rotate-6 z-20" 
                  : "top-[222px] right-[100px] -rotate-3 z-30"
              }`}
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
            >
              <UniversalImage
                id={image.src}
                alt={image.alt}
                className="w-full h-48 rounded-lg"
                style={{ objectFit: "cover" }}
                fieldContext={{ arrayPath: "right_images", index, srcField: "src" }}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
      </div>


    </section>
  );
}
