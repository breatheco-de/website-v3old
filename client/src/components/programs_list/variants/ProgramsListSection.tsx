import type { z } from "zod";
import type { programsListSectionSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowRight, IconCode, IconLoader2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useInternalNav } from "@/hooks/useInternalNav";

type ProgramsListSectionData = z.infer<typeof programsListSectionSchema>;

interface ProgramsListSectionProps {
  data: ProgramsListSectionData;
}

interface Program {
  slug: string;
  title: string;
}

export function ProgramsListSection({ data }: ProgramsListSectionProps) {
  const handleLinkClick = useInternalNav();
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const locationFilter = data.filter_by_location;

  const apiUrl = locationFilter 
    ? `/api/career-programs?locale=${locale}&location=${locationFilter}`
    : `/api/career-programs?locale=${locale}`;

  const { data: allPrograms, isLoading } = useQuery<Program[]>({
    queryKey: ["/api/career-programs", { locale, location: locationFilter }],
    queryFn: async () => {
      const response = await fetch(apiUrl);
      return response.json();
    },
  });

  const programs = allPrograms;

  const programUrl = (slug: string) => 
    locale === "es" 
      ? `/es/programas-de-carrera/${slug}` 
      : `/en/career-programs/${slug}`;

  return (
    <section 
      className="px-4"
      data-testid="section-programs-list"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 
            className="text-3xl md:text-4xl font-bold text-foreground mb-4"
            data-testid="text-programs-list-title"
          >
            {data.title}
          </h2>
          {data.subtitle && (
            <p 
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
              data-testid="text-programs-list-subtitle"
            >
              {data.subtitle}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : programs && programs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program, index) => (
              <Card 
                key={program.slug}
                className="border hover-elevate"
                data-testid={`card-program-${index}`}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <IconCode className="w-6 h-6 text-primary" />
                  </div>
                  <h3 
                    className="text-xl font-semibold text-foreground mb-4"
                    data-testid={`text-program-title-${index}`}
                  >
                    {program.title}
                  </h3>
                  <a href={programUrl(program.slug)} onClick={handleLinkClick}>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      data-testid={`button-program-learn-more-${index}`}
                    >
                      {locale === "es" ? "Ver Programa" : "Learn More"}
                      <IconArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            {locale === "es" 
              ? "No hay programas disponibles en este momento." 
              : "No programs available at this time."}
          </p>
        )}
      </div>
    </section>
  );
}
