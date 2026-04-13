import { useState, useCallback } from "react";
import type { ProjectShowcaseSection, ProjectsShowcaseSection, ProjectShowcaseItem } from "@shared/schema";
import { IconBrandGithub, IconBrandLinkedin, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

interface ProjectShowcaseProps {
  data: ProjectShowcaseSection | ProjectsShowcaseSection;
}

function SingleProjectShowcase({ item, background = "bg-background", alternateBackground = false, mediaPosition = "left" }: { 
  item: ProjectShowcaseItem; 
  background?: string;
  alternateBackground?: boolean;
  mediaPosition?: "left" | "right";
}) {
  const {
    project_title,
    project_url,
    description,
    creators,
    media,
  } = item;

  const [currentIndex, setCurrentIndex] = useState(0);

  const mediaItems = media || [];
  const hasCarousel = mediaItems.length > 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  }, [mediaItems.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  }, [mediaItems.length]);

  const bgClass = alternateBackground ? "bg-muted" : background;

  const renderMedia = () => {
    if (mediaItems.length > 0) {
      const currentMedia = mediaItems[currentIndex];
      if (currentMedia.type === "video") {
        return (
          <div className="rounded-lg overflow-hidden h-full">
            <LiteYouTubeEmbed
              id={currentMedia.src}
              title={project_title}
              poster="maxresdefault"
            />
          </div>
        );
      } else {
        return (
          <img
            src={currentMedia.src}
            alt={currentMedia.alt || project_title}
            className="w-full h-full rounded-lg object-cover"
            loading="lazy"
            data-testid="img-project-showcase"
          />
        );
      }
    }
    return null;
  };

  const detailsContent = (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          MADE BY
        </p>
        <div className="space-y-3">
          {creators.map((creator, index) => (
            <div key={index} data-testid={`creator-${index}`}>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">{">"} {creator.name}</span>
                {creator.github_url && (
                  <a
                    href={creator.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`${creator.name}'s GitHub`}
                    data-testid={`link-github-${index}`}
                  >
                    <IconBrandGithub size={20} />
                  </a>
                )}
                {creator.linkedin_url && (
                  <a
                    href={creator.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`${creator.name}'s LinkedIn`}
                    data-testid={`link-linkedin-${index}`}
                  >
                    <IconBrandLinkedin size={20} />
                  </a>
                )}
              </div>
              {creator.role && (
                <p className="text-sm text-muted-foreground pl-4">{creator.role}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground leading-relaxed" data-testid="text-project-description">
        {description}
      </p>

      {project_url && project_url !== "#" && (
        <a
          href={project_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-primary hover:underline font-medium"
          data-testid="link-project-url"
        >
          Visit Project →
        </a>
      )}
    </div>
  );

  return (
    <section className={`py-12 md:py-16 ${bgClass}`} data-testid="section-project-showcase">
      <div className="max-w-6xl mx-auto px-4">
        <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-8 text-center lg:text-left" data-testid="text-project-title">
          {project_title}
        </h3>

        <div className={`flex flex-col ${mediaPosition === "right" ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 lg:gap-12 items-start`}>
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-start">
            <div className="relative w-full md:max-w-[480px] lg:max-w-none">
              <div className="aspect-video lg:aspect-[16/9] md:max-h-[320px] rounded-lg overflow-hidden">
                {renderMedia()}
              </div>

              {hasCarousel && (
                <div className="flex justify-between items-center mt-4 gap-2" data-testid="carousel-pagination">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevious}
                    className="rounded-full border"
                    data-testid="button-carousel-prev"
                  >
                    <IconChevronLeft size={24} />
                  </Button>

                  <div className="flex items-center gap-2">
                    {mediaItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-3 h-3 rounded-full transition-colors ${
                          currentIndex === index 
                            ? "bg-primary" 
                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                        data-testid={`button-pagination-dot-${index}`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNext}
                    className="rounded-full border"
                    data-testid="button-carousel-next"
                  >
                    <IconChevronRight size={24} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-1/2">
            <Card className="lg:border-0 lg:shadow-none lg:bg-transparent">
              <CardContent className="p-4 lg:p-0">
                {detailsContent}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectShowcase({ data }: ProjectShowcaseProps) {
  // Check if this is a multi-item showcase (projects_showcase type)
  if ('items' in data && Array.isArray(data.items)) {
    return (
      <>
        {data.items.map((item, index) => (
          <SingleProjectShowcase 
            key={index} 
            item={item} 
            alternateBackground={index % 2 === 1}
            mediaPosition={index % 2 === 1 ? "right" : "left"}
          />
        ))}
      </>
    );
  }

  // Single project showcase (project_showcase type)
  const singleData = data as ProjectShowcaseSection;
  const item: ProjectShowcaseItem = {
    project_title: singleData.project_title,
    description: singleData.description,
    creators: singleData.creators,
    media: singleData.media,
  };

  return (
    <SingleProjectShowcase 
      item={item} 
      background={singleData.background}
    />
  );
}
