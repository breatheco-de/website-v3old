import { Card } from "@/components/ui/card";
import type { AboutSection as AboutSectionType } from "@shared/schema";

interface AboutProps {
  data: AboutSectionType;
}

export function About({ data }: AboutProps) {
  const { title, description, link_text, link_url, image_src, image_alt, height = "auto" } = data;

  return (
    <section className="bg-muted" data-testid="section-about">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-h2 text-foreground text-center mb-8 uppercase tracking-wide" data-testid="text-about-title">
          {title}
        </h2>

        {/* Mobile/Tablet: Image above, then text */}
        <div className="lg:hidden">
          <div className="mb-6 flex justify-center">
            <img
              src={image_src}
              alt={image_alt}
              className="w-64 object-cover rounded-card"
              loading="lazy"
              data-testid="img-about-mobile"
            />
          </div>
          <div className="text-center">
            <p className="text-muted-foreground leading-relaxed mb-6" data-testid="text-about-description-mobile">
              {description}
            </p>
            <a
              href={link_url}
              className="text-primary hover:underline font-medium"
              data-testid="link-about-read-more-mobile"
            >
              {link_text} {">"}
            </a>
          </div>
        </div>

        {/* Desktop: Side by side with card */}
        <div 
          className="hidden lg:flex lg:flex-row gap-0 items-stretch"
          style={{ height: height !== "auto" ? height : undefined }}
        >
          <Card className="flex-1 p-8 flex flex-col justify-center rounded-r-none lg:rounded-l-lg z-10">
            <p className="text-muted-foreground leading-relaxed text-center mb-6" data-testid="text-about-description">
              {description}
            </p>
            <a
              href={link_url}
              className="text-primary hover:underline font-medium text-center"
              data-testid="link-about-read-more"
            >
              {link_text} {">"}
            </a>
          </Card>

          <div className="flex-1 min-h-0">
            <img
              src={image_src}
              alt={image_alt}
              className="w-full h-full object-cover rounded-r-lg"
              loading="lazy"
              data-testid="img-about"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
