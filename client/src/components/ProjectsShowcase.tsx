import { useState } from "react";
import { ChevronLeft, ChevronRight, Github, Linkedin } from "lucide-react";
import type { ProjectsShowcaseSection, ProjectShowcaseItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

interface ProjectsShowcaseProps {
  data: ProjectsShowcaseSection;
}

interface SingleProjectProps {
  project: ProjectShowcaseItem;
  mediaPosition: "left" | "right";
  background: string;
}

function SingleProject({ project, mediaPosition, background }: SingleProjectProps) {
  const { project_title, project_url, description, creators, media, image, video_id } = project;

  const [currentIndex, setCurrentIndex] = useState(0);

  const mediaItems = media || [];
  const hasCarousel = mediaItems.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

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

    if (video_id) {
      return (
        <div className="rounded-lg overflow-hidden h-full">
          <LiteYouTubeEmbed
            id={video_id}
            title={project_title}
            poster="maxresdefault"
          />
        </div>
      );
    }

    if (image) {
      return (
        <img
          src={image}
          alt={project_title}
          className="w-full h-full rounded-lg object-cover"
          loading="lazy"
          data-testid="img-project-showcase"
        />
      );
    }

    return null;
  };

  const InfoContent = () => (
    <>
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
                    <Github size={20} />
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
                    <Linkedin size={20} />
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
    </>
  );

  return (
    <section className={`py-12 md:py-16 ${background}`} data-testid="section-project-showcase">
      <div className="max-w-6xl mx-auto px-4">
        {/* Mobile/md: Title centered above carousel */}
        <h3 className="text-2xl font-bold text-foreground text-center mb-6 lg:hidden" data-testid="text-project-title-mobile">
          {project_title}
        </h3>

        <div className={`flex flex-col ${mediaPosition === "right" ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 lg:gap-12 items-start`}>
          {/* Media column - full width on mobile, smaller on md, half on lg+ */}
          <div className="w-full md:w-3/4 md:mx-auto lg:w-1/2 lg:mx-0">
            <div className="relative">
              <div className="aspect-video rounded-lg overflow-hidden">
                {renderMedia()}
              </div>

              {hasCarousel && (
                <div className="flex justify-between items-center mt-4" data-testid="carousel-pagination">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevious}
                    className="rounded-full border"
                    data-testid="button-carousel-prev"
                  >
                    <ChevronLeft size={24} />
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
                    <ChevronRight size={24} />
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop only: project URL below carousel */}
            {project_url && (
              <a
                href={project_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline-flex items-center gap-1 text-primary hover:underline mt-4"
                data-testid="link-project-url"
              >
                {project_title} {">"}
              </a>
            )}

            {/* Mobile/md: Info in a card below carousel */}
            <Card className="mt-6 p-6 space-y-6 lg:hidden">
              <InfoContent />
            </Card>

            {/* Mobile/md: project URL below card */}
            {project_url && (
              <a
                href={project_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex lg:hidden items-center gap-1 text-primary hover:underline mt-4"
                data-testid="link-project-url-mobile"
              >
                {project_title} {">"}
              </a>
            )}
          </div>

          {/* Desktop (lg+): Text column with title and info */}
          <div className="hidden lg:block w-full lg:w-1/2 space-y-6">
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground" data-testid="text-project-title">
              {project_title}
            </h3>

            <InfoContent />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectsShowcase({ data }: ProjectsShowcaseProps) {
  const { items } = data;

  return (
    <>
      {items.map((project, index) => (
        <SingleProject
          key={index}
          project={project}
          mediaPosition={index % 2 === 0 ? "left" : "right"}
          background={index % 2 === 0 ? "bg-muted" : "bg-background"}
        />
      ))}
    </>
  );
}
