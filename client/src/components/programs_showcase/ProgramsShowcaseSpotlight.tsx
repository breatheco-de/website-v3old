import type { ProgramsShowcaseSection, ProgramItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import { IconClock, IconArrowRight, IconTrendingUp } from "@tabler/icons-react";
import { resolveColorVar, hslColor } from "./shared";

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
  const BadgeIcon = program.badge_icon ? getIcon(program.badge_icon) : IconTrendingUp;
  const resolved = resolveColorVar(program.color);
  const ctaText = program.cta?.text ?? program.cta_text;
  const ctaUrl = program.cta?.url ?? program.cta_url ?? "#";

  return (
    <div
      className="flex flex-col group h-full border rounded-card bg-[hsl(var(--primary)/0.05)] border-[hsl(var(--primary)/0.2)]"
      data-testid={`card-featured-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="p-7 flex flex-col gap-5 h-full">
        <div className="flex items-center justify-between gap-3">
          {Icon && (
            <Icon
              className="w-7 h-7 text-primary"
            />
          )}

        </div>

        <div className="flex-1">
          {featuredLabel && (
            <div className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground">
              {featuredLabel}
            </div>
          )}
          <h3
            className="text-2xl font-bold leading-snug mb-3 text-foreground font-heading"
            style={{ letterSpacing: "-0.01em" }}
          >
            {program.name}
          </h3>
          {program.badge && (
            <div
              className="inline-flex items-center mb-2 gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-primary/40"
              data-testid={`badge-featured-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
              {program.badge}
            </div>
          )}
          <p className="text-base leading-relaxed text-muted-foreground">
            {program.description}
          </p>
        </div>

        <div
          className="flex items-center justify-between gap-3 pt-4 flex-wrap"
          style={{ borderTop: "1px solid hsl(var(--primary) / 0.2)" }}
        >
          {showSalary && program.avg_salary ? (
            <div className="flex flex-col">
              {salaryLabel && (
                <span className="text-xs text-muted-foreground">{salaryLabel}</span>
              )}
              <span className="text-base text-foreground">{program.avg_salary}</span>
            </div>
          ) : program.duration ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconClock className="w-3.5 h-3.5" />
              <span>{program.duration}</span>
            </div>
          ) : null}
          {ctaText && (
            <a
              href={ctaUrl}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline transition-all duration-150 group-hover:gap-2.5"
              data-testid={`link-cta-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {ctaText}
              <IconArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SmallCard({
  program,
  showSalary,
  salaryLabel,
}: {
  program: ProgramItem;
  showSalary: boolean;
  salaryLabel?: string;
}) {
  const Icon = program.icon ? getIcon(program.icon) : null;
  const BadgeIcon = program.badge_icon ? getIcon(program.badge_icon) : IconTrendingUp;
  const resolved = resolveColorVar(program.color);
  const ctaText = program.cta?.text ?? program.cta_text ?? "";
  const ctaUrl = program.cta?.url ?? program.cta_url ?? "#";

  return (
    <div
      className="group rounded-card border bg-card border-border"
      data-testid={`card-program-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <Icon
              className="w-6 h-6 shrink-0 mt-0.5 text-primary"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="gap-2">
              <h3
                className="text-base font-bold leading-snug text-foreground font-heading"
                style={{ letterSpacing: "-0.01em" }}
              >
                {program.name}
              </h3>
              {program.badge && (
                <div
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 mt-1 rounded-full shrink-0 bg-secondary"

                  data-testid={`badge-program-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                  {program.badge}
                </div>
              )}
            </div>
            <p className="text-sm leading-relaxed mt-1 text-muted-foreground">
              {program.description}
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 pt-3 flex-wrap"
          style={{ borderTop: "1px solid hsl(var(--border))" }}
        >
          {showSalary && program.avg_salary ? (
            <div className="flex flex-col">
              {salaryLabel && (
                <span className="text-xs text-muted-foreground">{salaryLabel}</span>
              )}
              <span className="text-base text-foreground">{program.avg_salary}</span>
            </div>
          ) : program.duration ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconClock className="w-3.5 h-3.5" />
              <span>{program.duration}</span>
            </div>
          ) : null}
          {ctaText && (
            <a
              href={ctaUrl}
              className="flex items-center gap-1 text-sm font-semibold hover:underline transition-all duration-150 group-hover:gap-2 text-muted-foreground"
              data-testid={`link-cta-${program.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {ctaText}
              <IconArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </a>
          )}
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
      className="max-w-6xl mx-auto px-4"
      data-testid="section-programs-showcase-spotlight"
    >
      <div>
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
                className="text-base max-w-xl mx-auto text-muted-foreground leading-relaxed"
                data-testid="text-subheading"
              >
                {data.subheading}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-5">
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
            {rest.map((program) => (
              <SmallCard
                key={program.name}
                program={program}
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
