import type { ProgramsShowcaseSection, ProgramItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import { IconClock, IconTrendingUp, IconArrowRight } from "@tabler/icons-react";
import { resolveColor, hsl } from "./shared";

interface ProgramsShowcaseGridProps {
  data: ProgramsShowcaseSection;
}

function ProgramCard({
  program,
  showSalary,
  salaryLabel,
}: {
  program: ProgramItem;
  showSalary: boolean;
  salaryLabel?: string;
}) {
  const colorVar = resolveColor(program.color);
  const Icon = program.icon ? getIcon(program.icon) : null;

  return (
    <div
      className="relative flex flex-col bg-card border border-border rounded-card group"
      data-testid={`card-program-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="p-card-padding flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {Icon && (
            <Icon
              className="w-7 h-7 shrink-0"
              style={{ color: hsl(colorVar) }}
              strokeWidth={1.5}
            />
          )}
          {program.demand && (
            <div
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 font-sans"
              style={{
                color: hsl(colorVar),
                backgroundColor: hsl(colorVar, 0.1),
              }}
              data-testid={`badge-demand-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <IconTrendingUp className="w-3 h-3" />
              {program.demand}
            </div>
          )}
        </div>

        <div className="flex-1">
          {program.role_label && (
            <div className="text-xs font-semibold uppercase tracking-widest mb-1 text-muted-foreground font-sans">
              {program.role_label}
            </div>
          )}
          {program.role && (
            <h3
              className="text-lg font-bold leading-snug mb-1 text-foreground font-heading"
              style={{ letterSpacing: "-0.01em" }}
            >
              {program.role}
            </h3>
          )}
          <div className="text-xs mb-2 text-muted-foreground font-sans">
            {program.name}
          </div>
          <p className="text-base leading-relaxed text-muted-foreground font-sans">
            {program.description}
          </p>
        </div>

        <div
          className="flex items-center justify-between gap-3 pt-4 flex-wrap"
          style={{ borderTop: `1px solid ${hsl(colorVar)}` }}
        >
          {showSalary ? (
            <div className="flex flex-col">
              {salaryLabel && (
                <span className="text-xs text-muted-foreground font-sans">{salaryLabel}</span>
              )}
              <span className="text-base text-foreground font-sans">{program.avg_salary}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
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
  );
}

export function ProgramsShowcaseGrid({ data }: ProgramsShowcaseGridProps) {
  const showSalary = data.show_salary ?? false;

  return (
    <section
      className="py-spacing-section"
      data-testid="section-programs-showcase-grid"
    >
      <div className="max-w-4xl mx-auto px-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.programs.map((program) => (
            <ProgramCard
              key={program.name}
              program={program}
              showSalary={showSalary}
              salaryLabel={data.salary_label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
