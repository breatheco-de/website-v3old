import type { ProgramsShowcaseSection, ProgramItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import { IconClock, IconArrowRight } from "@tabler/icons-react";

interface ProgramsShowcaseSpotlightProps {
  data: ProgramsShowcaseSection;
}

function FeaturedCard({
  program,
  featuredLabel,
  showSalary,
  salaryLabel,
}: {
  program: ProgramItem;
  featuredLabel?: string;
  showSalary: boolean;
  salaryLabel?: string;
}) {
  const Icon = program.icon ? getIcon(program.icon) : null;

  return (
    <div
      className="flex flex-col group h-full bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.2)] rounded-card"
      data-testid={`card-featured-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="p-7 flex flex-col gap-5 h-full">
        {Icon && (
          <Icon
            className="w-8 h-8 text-primary"
            strokeWidth={1.5}
          />
        )}

        <div className="flex-1">
          {featuredLabel && (
            <div className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground font-sans">
              {featuredLabel}
            </div>
          )}
          <h3
            className="text-2xl font-bold leading-snug mb-3 text-foreground font-heading"
            style={{ letterSpacing: "-0.01em" }}
          >
            {program.name}
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground font-sans">
            {program.description}
          </p>
        </div>

        <div
          className="flex items-center justify-between gap-3 pt-4 flex-wrap"
          style={{ borderTop: "1px solid hsl(var(--primary) / 0.2)" }}
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
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline transition-all duration-150 group-hover:gap-2.5 font-sans"
            data-testid={`link-cta-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {program.cta_text}
            <IconArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function SmallCard({
  program,
  odd,
  showSalary,
  salaryLabel,
}: {
  program: ProgramItem;
  odd: boolean;
  showSalary: boolean;
  salaryLabel?: string;
}) {
  const Icon = program.icon ? getIcon(program.icon) : null;

  const bgClass = odd
    ? "bg-[hsl(var(--primary)/0.05)] border-[hsl(var(--primary)/0.2)]"
    : "bg-card border-border";
  const footerBorderColor = odd
    ? "hsl(var(--primary) / 0.2)"
    : "hsl(var(--border))";
  const ctaColorClass = odd ? "text-primary" : "text-muted-foreground";

  return (
    <div
      className={`group rounded-card border ${bgClass}`}
      data-testid={`card-program-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <Icon
              className="w-6 h-6 shrink-0 mt-0.5 text-primary"
              strokeWidth={1.5}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-bold leading-snug text-foreground font-heading"
              style={{ letterSpacing: "-0.01em" }}
            >
              {program.name}
            </h3>
            <p className="text-sm leading-relaxed mt-1 text-muted-foreground font-sans">
              {program.description}
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 pt-3 flex-wrap"
          style={{ borderTop: `1px solid ${footerBorderColor}` }}
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
            className={`flex items-center gap-1 text-sm font-semibold hover:underline transition-all duration-150 group-hover:gap-2 font-sans ${ctaColorClass}`}
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

export function ProgramsShowcaseSpotlight({ data }: ProgramsShowcaseSpotlightProps) {
  const showSalary = data.show_salary ?? false;
  const salaryLabel = data.salary_label ?? (showSalary ? "Avg. salary" : undefined);
  const featured = data.programs[0];
  const rest = data.programs.slice(1);

  return (
    <section
      className="py-spacing-section"
      data-testid="section-programs-showcase-spotlight"
    >
      <div className="max-w-5xl mx-auto px-6">
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

        <div className="flex flex-col md:flex-row items-start gap-5">
          <div className="w-full md:w-[38%]">
            {featured && (
              <FeaturedCard
                program={featured}
                featuredLabel={data.featured_label}
                showSalary={showSalary}
                salaryLabel={salaryLabel}
              />
            )}
          </div>

          <div className="flex-1 flex flex-col gap-3 w-full">
            {rest.map((program, index) => (
              <SmallCard
                key={program.name}
                program={program}
                odd={index % 2 === 0}
                showSalary={showSalary}
                salaryLabel={salaryLabel}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
