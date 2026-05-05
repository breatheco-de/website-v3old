
import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WhosHiringSection as WhosHiringSectionType } from "@shared/schema";
import UniversalImage from "@/components/UniversalImage";

interface WhosHiringGridProps {
  data: WhosHiringSectionType;
}

export default function WhosHiringGrid({ data }: WhosHiringGridProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const logos = data.logos || [];
  const LOGOS_PER_PAGE = isMobile ? 4 : 8;
  const totalPages = Math.ceil(logos.length / LOGOS_PER_PAGE);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const goToPrevious = useCallback(() => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  }, [totalPages]);

  const goToNext = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  }, [totalPages]);

  const currentLogos = logos.slice(
    currentPage * LOGOS_PER_PAGE,
    currentPage * LOGOS_PER_PAGE + LOGOS_PER_PAGE
  );

  if (logos.length === 0) {
    return null;
  }

  return (
    <section 
      className="bg-background"
      data-testid="section-whos-hiring"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 
            className="text-h2 mb-3 text-foreground"
            data-testid="text-whos-hiring-title"
          >
            {data.title}
          </h2>
          {data.subtitle && (
            <p 
              className="text-body mb-4 text-foreground"
              data-testid="text-whos-hiring-subtitle"
            >
              {data.subtitle}
            </p>
          )}
          {data.description && (
            <p 
              className="text-body max-w-3xl mx-auto text-muted-foreground"
              data-testid="text-whos-hiring-description"
            >
              {data.description}
            </p>
          )}
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currentLogos.map((logo, index) => (
              <Card 
                key={`${currentPage}-${index}`} 
                className="p-3 lg:p-6 flex items-center justify-center h-20 sm:h-40"
                data-testid={`card-logo-${currentPage * LOGOS_PER_PAGE + index}`}
              >
                <UniversalImage
                  id={logo.src}
                  alt={logo.alt}
                  className="max-h-16 max-w-full object-contain"
                  loading="lazy"
                  fieldContext={{ arrayPath: "logos", index: currentPage * LOGOS_PER_PAGE + index, srcField: "src" }}
                />
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-8" data-testid="carousel-pagination">
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
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={`w-3 h-3 rounded-full transition-colors duration-brand ease-brand ${
                      currentPage === index 
                        ? "bg-primary" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    data-testid={`button-pagination-dot-${index}`}
                    aria-label={`Go to page ${index + 1}`}
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
      </div>
    </section>
  );
}
