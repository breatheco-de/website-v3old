import { useState, useEffect } from "react";
import Marquee from "react-fast-marquee";
import type {
  HeroProductShowcase as HeroProductShowcaseType,
  HeroApplyFormProductShowcase,
} from "@shared/schema";
import { UniversalVideo } from "@/components/UniversalVideo";
import { UniversalImage } from "@/components/UniversalImage";
import { Button } from "@/components/ui/button";
import { IconStarFilled, IconArrowRight, IconCheck } from "@tabler/icons-react";
import { resolveTemplateFallback } from "@/lib/variable-manager";
import { LeadForm, type LeadFormData } from "@/components/LeadForm";
import { AwardsMarquee } from "@/components/AwardsMarquee";
import { useInternalNav } from "@/hooks/useInternalNav";
import { Card } from "@/components/ui/card";
import { RichTextContent } from "@/components/ui/rich-text-content";

function parseLogoHeight(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

interface HeroProductShowcaseProps {
  data: HeroProductShowcaseType | HeroApplyFormProductShowcase;
  landingLocations?: string[];
}

export function HeroProductShowcase({
  data,
  landingLocations,
}: HeroProductShowcaseProps) {
  // Hide background image on screens smaller than 1280px for better mobile experience
  const [showBackground, setShowBackground] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setShowBackground(window.innerWidth >= 1280);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const handleLinkClick = useInternalNav();

  // Cast to the full type to access optional properties
  const fullData = data as HeroProductShowcaseType;

  // Safely access properties that may not exist on all variants
  const backgroundImage = fullData.background_image ?? null;
  const welcomeText = fullData.welcome_text ?? null;
  const subtitle = fullData.subtitle ?? null;
  const video = fullData.video ?? null;
  const rawImage = fullData.image ?? null;
  const imageSrc =
    typeof rawImage === "string" ? rawImage : (rawImage?.src ?? null);
  const imageAlt =
    typeof rawImage === "string"
      ? (fullData.image_alt ?? "")
      : (rawImage?.alt ?? "");
  const imageObjectFit = (fullData as any).image_object_fit as
    | string
    | undefined;
  const imageObjectPosition = (fullData as any).image_object_position as
    | string
    | undefined;
  const hasMedia = !!(video?.url || imageSrc);
  const formVerticalAlign = (fullData as any).form_vertical_align as
    | string
    | undefined;
  const marquee = fullData.marquee ?? null;
  const bullets = fullData.bullets ?? null;
  const leftImages = fullData.left_images ?? null;
  const rightImages = fullData.right_images ?? null;
  const hasDecorativeImages =
    (leftImages && leftImages.length > 0) ||
    (rightImages && rightImages.length > 0);
  const showAwardsMarquee = (fullData as any).show_awards_marquee === true;
  const awardsMarquee = (fullData as any).awards_marquee as
    | {
        items?: any[];
        speed?: number;
        gradient?: boolean;
        gradientWidth?: number;
      }
    | undefined;

  const shouldShowBackground = backgroundImage && showBackground;

  const colorMap: Record<string, string> = {
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    "chart-1": "hsl(var(--chart-1))",
    "chart-2": "hsl(var(--chart-2))",
    "chart-3": "hsl(var(--chart-3))",
    "chart-4": "hsl(var(--chart-4))",
    "chart-5": "hsl(var(--chart-5))",
  };

  return (
    <section
      id="hero-form"
      className="relative overflow-hidden"
      style={
        shouldShowBackground
          ? {
              backgroundImage: `url(${backgroundImage!.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      data-testid="section-hero"
    >
      {/* Left decorative images - only shown on xl screens when images exist */}
      {hasDecorativeImages && leftImages && leftImages.length > 0 && (
        <div className="absolute left-0 top-0 h-full w-[200px] hidden xl:block pointer-events-none z-0">
          <div className="relative h-full">
            {leftImages.map((image, index) => (
              <div
                key={index}
                className={`absolute w-44 transform transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] pointer-events-auto ${
                  index === 0
                    ? "top-[80px] left-4 -rotate-6"
                    : "top-[240px] left-12 rotate-3"
                }`}
                style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
                data-testid={`img-hero-left-${index}`}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-40 object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Right decorative images - only shown on xl screens when images exist */}
      {hasDecorativeImages && rightImages && rightImages.length > 0 && (
        <div className="absolute right-0 top-0 h-full w-[200px] hidden xl:block pointer-events-none z-0">
          <div className="relative h-full">
            {rightImages.map((image, index) => (
              <div
                key={index}
                className={`absolute w-44 transform transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] pointer-events-auto ${
                  index === 0
                    ? "top-[80px] right-4 rotate-6"
                    : "top-[240px] right-12 -rotate-3"
                }`}
                style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
                data-testid={`img-hero-right-${index}`}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-40 object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-5 gap-3 md:gap-16 items-start">
          <div className="md:col-span-3 flex flex-col items-center md:items-start justify-start min-w-0">
            <div className="text-center md:text-left relative w-full min-w-0 pl-[0px] pr-[0px] mt-[24px] mb-[24px]">
              {welcomeText && (
                <p className="text-4xl text-muted-foreground">{welcomeText}</p>
              )}

              {data.brand_mark && (
                <h1 className="font-heading text-h1 tracking-tight">
                  {data.brand_mark.prefix && (
                    <span className="text-foreground">
                      {data.brand_mark.prefix}{" "}
                    </span>
                  )}
                  <span
                    style={{
                      color: colorMap[data.brand_mark.color || "primary"],
                    }}
                  >
                    {data.brand_mark.highlight}
                  </span>
                  {data.brand_mark.suffix && (
                    <span className="text-foreground">
                      {" "}
                      {data.brand_mark.suffix}
                    </span>
                  )}
                </h1>
              )}
              <h2
                className="text-4xl lg:text-5xl font-medium text-foreground"
                data-testid="text-hero-title"
              >
                {data.title}
              </h2>

              {subtitle && (
                <p
                  className="text-4xl text-muted-foreground mb-8 max-w-xl leading-[42px] mt-3"
                  data-testid="text-hero-subtitle"
                >
                  {subtitle}
                </p>
              )}

              {data.description && (
                <div className="relative">
                  <RichTextContent
                    html={data.description}
                    className="text-body text-foreground mt-2 mb-0 md:mb-8 max-w-xl leading-relaxed [&_p]:mb-0"
                    data-testid="text-hero-description"
                  />
                </div>
              )}

              {bullets && bullets.length > 0 && (
                <div className="flex justify-center md:block">
                  <ul
                    className="mt-4 md:mb-4 space-y-2 max-w-xl"
                    data-testid="hero-bullets"
                  >
                    {bullets.map((bullet, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-foreground"
                        data-testid={`hero-bullet-${index}`}
                      >
                        <IconCheck className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                        <span className="text-body leading-relaxed text-left">
                          {bullet.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.footer && (
                <div className="relative">
                  <RichTextContent
                    html={data.footer}
                    className="text-sm text-muted-foreground leading-relaxed [&_p]:mb-0"
                    data-testid="text-hero-footer"
                  />
                </div>
              )}

              {marquee && marquee.items && marquee.items.length > 0 && (
                <div
                  className="w-full max-w-xl mt-6 md:mb-8 overflow-hidden"
                  data-testid="hero-embedded-marquee"
                >
                  <Marquee
                    speed={marquee.speed || 40}
                    pauseOnHover={false}
                    gradient={marquee.gradient ?? true}
                    gradientColor={marquee.gradientColor}
                    gradientWidth={marquee.gradientWidth || 60}
                    autoFill={true}
                  >
                    {marquee.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-center mx-4 transition-opacity duration-brand ease-brand hover:opacity-80"
                        data-testid={`hero-marquee-item-${index}`}
                      >
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt={item.alt}
                            style={{
                              height: parseLogoHeight(item.logoHeight) || 48,
                            }}
                            className="w-auto object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              {item.source} {item.year && `${item.year}`}
                            </span>
                            <span className="text-sm font-medium text-foreground mt-0.5">
                              {item.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </Marquee>
                </div>
              )}

              {data.form && hasMedia && (
                <div className="hidden md:flex mt-2 mb-8 justify-center md:justify-start">
                  <LeadForm
                    data={
                      {
                        ...data.form,
                        variant: data.form.variant || "inline",
                        consent: data.form.consent,
                        show_terms: data.form.show_terms ?? false,
                        className: "w-full max-w-md",
                      } as LeadFormData
                    }
                    landingLocations={landingLocations}
                  />
                </div>
              )}

              {data.cta_button && !data.form && (
                <div className="mt-2 mb-8">
                  <Button
                    variant={
                      data.cta_button.variant === "outline"
                        ? "outline"
                        : "default"
                    }
                    size="lg"
                    asChild
                    data-testid="button-hero-cta"
                  >
                    <a href={data.cta_button.url} onClick={handleLinkClick}>
                      {data.cta_button.text}
                      <IconArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {data.trust_bar && (
                <div className="flex justify-center md:justify-start">
                  <div className="inline-flex flex-wrap items-center gap-4 text-sm text-muted-foreground bg-muted/50 rounded-card px-4 py-3 transition-all duration-brand ease-brand">
                    <div className="flex flex-col gap-1">
                      {data.trust_bar.rating && (
                        <div className="flex items-center gap-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const rating = parseFloat(
                                resolveTemplateFallback(
                                  data.trust_bar!.rating || "0",
                                ),
                              );
                              const fullStars = Math.floor(rating);
                              const hasHalf = rating % 1 >= 0.5;
                              const isHalfStar =
                                hasHalf && star === fullStars + 1;

                              if (star <= fullStars) {
                                return (
                                  <IconStarFilled
                                    key={star}
                                    className="h-6 w-6 text-yellow-500"
                                  />
                                );
                              } else if (isHalfStar) {
                                return (
                                  <div key={star} className="relative h-6 w-6">
                                    <IconStarFilled className="h-6 w-6 text-muted" />
                                    <div
                                      className="absolute inset-0 overflow-hidden"
                                      style={{ width: "50%" }}
                                    >
                                      <IconStarFilled className="h-6 w-6 text-yellow-500" />
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <IconStarFilled
                                    key={star}
                                    className="h-6 w-6 text-muted"
                                  />
                                );
                              }
                            })}
                          </div>
                        </div>
                      )}
                      {data.trust_bar.review_count && (
                        <span className="text-[12px] font-bold">
                          {String(data.trust_bar.review_count)}
                        </span>
                      )}
                    </div>
                    {data.trust_bar.review_logos &&
                      data.trust_bar.review_logos.length > 0 && (
                        <div className="flex items-center gap-3">
                          {data.trust_bar.review_logos.map((logo, index) =>
                            logo.logo ? (
                              <img
                                key={index}
                                src={logo.logo}
                                alt={logo.name}
                                className="h-10 object-contain"
                                data-testid={`img-review-logo-${index}`}
                              />
                            ) : (
                              <span
                                key={index}
                                className="font-medium text-foreground"
                                data-testid={`text-review-logo-${index}`}
                              >
                                {logo.name}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={`md:col-span-2 w-full md:w-auto min-w-0 flex justify-center md:justify-start ${!hasMedia && formVerticalAlign === "center" ? "items-center h-full" : !hasMedia && formVerticalAlign === "bottom" ? "items-end h-full" : "items-start"}`}
          >
            {video && video.url ? (
              <UniversalVideo
                url={video.url}
                ratio={video.ratio || "16:9"}
                mobileRatio={video.mobile_ratio || "16:11"}
                muted={video.muted}
                autoplay={video.autoplay}
                loop={video.loop}
                preview_image_url={video.preview_image_url}
                withShadowBorder={video.with_shadow_border}
                className="w-[280px] md:w-full md:max-w-[400px]"
              />
            ) : imageSrc ? (
              <div className="min-w-0">
                <UniversalImage
                  id={imageSrc}
                  alt={imageAlt}
                  className="w-full max-w-[500px] rounded-card shadow-card"
                  style={{
                    ...(imageObjectFit
                      ? { objectFit: imageObjectFit as any }
                      : {}),
                    ...(imageObjectPosition
                      ? { objectPosition: imageObjectPosition }
                      : {}),
                  }}
                  data-testid="img-hero-product"
                />
                {showAwardsMarquee &&
                  awardsMarquee?.items &&
                  awardsMarquee.items.length > 0 && (
                    <div
                      className="mt-8 w-full"
                      data-testid="hero-awards-marquee"
                    >
                      <AwardsMarquee
                        items={awardsMarquee.items}
                        speed={awardsMarquee.speed}
                        gradient={awardsMarquee.gradient}
                        gradientWidth={awardsMarquee.gradientWidth}
                      />
                    </div>
                  )}
              </div>
            ) : data.form ? (
              <div className="w-full">
                <Card
                  className="hidden md:block w-full bg-background p-4 rounded-lg"
                  data-testid="hero-form-right"
                >
                  <LeadForm
                    data={
                      {
                        ...data.form,
                        variant: data.form.variant || "stacked",
                        consent: data.form.consent,
                        show_terms: data.form.show_terms ?? false,
                        className: "w-full",
                      } as LeadFormData
                    }
                    landingLocations={landingLocations}
                  />
                </Card>
                {showAwardsMarquee &&
                  awardsMarquee?.items &&
                  awardsMarquee.items.length > 0 && (
                    <div
                      className="mt-8 w-full"
                      data-testid="hero-awards-marquee"
                    >
                      <AwardsMarquee
                        items={awardsMarquee.items}
                        speed={awardsMarquee.speed}
                        gradient={awardsMarquee.gradient}
                        gradientWidth={awardsMarquee.gradientWidth}
                      />
                    </div>
                  )}
              </div>
            ) : null}
          </div>

          {data.form && (
            <div className="md:hidden mt-4 flex justify-center w-full">
              <LeadForm
                data={
                  {
                    ...data.form,
                    variant: data.form.variant || "inline",
                    consent: data.form.consent,
                    show_terms: data.form.show_terms ?? false,
                    className: "w-full max-w-md",
                  } as LeadFormData
                }
                landingLocations={landingLocations}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
