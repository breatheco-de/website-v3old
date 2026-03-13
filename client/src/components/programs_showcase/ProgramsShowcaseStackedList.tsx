import type { ProgramsShowcaseSection, ProgramItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import { IconClock, IconArrowRight } from "@tabler/icons-react";
import { resolveColor, hsl } from "./shared";

interface ProgramsShowcaseStackedListProps {
  data: ProgramsShowcaseSection;
}

function StackedListItem({
  program,
  isLast,
  showSalary,
  salaryLabel,
}: {
  program: ProgramItem;
  isLast: boolean;
  showSalary: boolean;
  salaryLabel?: string;
}) {
  const colorVar = resolveColor(program.color);
  const Icon = program.icon ? getIcon(program.icon) : null;

  return (
    <div
      className="group flex items-stretch transition-colors duration-150 hover:bg-muted/50"
      style={{
        borderBottom: isLast ? "none" : "1px solid hsl(var(--border))",
      }}
      data-testid={`row-program-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="w-0.5 shrink-0 rounded-full my-7 ml-6 md:ml-8"
        style={{ backgroundColor: hsl(colorVar) }}
      />

      <div className="flex items-start gap-4 md:gap-5 py-7 pl-4 md:pl-6 pr-6 md:pr-8 flex-1">
        {Icon && (
          <Icon
            className="w-7 h-7 shrink-0 mt-0.5 self-start"
            style={{ color: hsl(colorVar) }}
            strokeWidth={1.5}
          />
        )}

        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:justify-between gap-4 md:gap-6">
          <div className="flex-1">
            <h3
              className="text-xl font-bold leading-snug text-foreground font-heading"
              style={{ letterSpacing: "-0.01em" }}
            >
              {program.name}
            </h3>
            <p className="text-base leading-relaxed mt-1.5 max-w-lg text-muted-foreground font-sans">
              {program.description}
            </p>
          </div>

          <div className="flex flex-row md:flex-col justify-between md:justify-between items-center md:items-end gap-2 shrink-0 md:pt-1">
            {showSalary && program.avg_salary ? (
              <div className="flex flex-col items-end">
                {salaryLabel && (
                  <span className="text-xs text-muted-foreground font-sans">{salaryLabel}</span>
                )}
                <span className="text-base text-foreground font-sans">{program.avg_salary}</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-sans"
                style={{
                  color: hsl(colorVar),
                  backgroundColor: hsl(colorVar, 0.1),
                  fontWeight: 600,
                }}
              >
                <IconClock className="w-3.5 h-3.5" />
                <span>{program.duration}</span>
              </div>
            )}

            <a
              href={program.cta_url}
              className="flex items-center gap-1 text-sm font-semibold hover:underline transition-all duration-150 group-hover:gap-2 font-sans"
              style={{ color: hsl(colorVar) }}
              data-testid={`link-cta-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {program.cta_text}
              <IconArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgramsShowcaseStackedList({ data }: ProgramsShowcaseStackedListProps) {
  const showSalary = data.show_salary ?? false;

  return (
    <section
      className="py-spacing-section"
      data-testid="section-programs-showcase-stacked-list"
    >
      <div className="max-w-3xl mx-auto px-6">
        {(data.heading || data.subheading) && (
          <div className="text-center mb-10">
            {data.heading && (
              <h2
                className="text-h2 font-heading font-bold mb-3 text-foreground"
                data-testid="text-heading"
              >
                {data.heading}
              </h2>
            )}
            {data.subheading && (
              <p
                className="text-base max-w-xl mx-auto text-muted-foreground font-sans leading-relaxed"
                data-testid="text-subheading"
              >
                {data.subheading}
              </p>
            )}
          </div>
        )}

        <div className="bg-card rounded-card border border-border overflow-hidden">
          {data.programs.map((program, index) => (
            <StackedListItem
              key={program.name}
              program={program}
              isLast={index === data.programs.length - 1}
              showSalary={showSalary}
              salaryLabel={data.salary_label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
