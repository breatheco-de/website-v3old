import { useMemo } from "react";
import type { CourseSelectorSection, CourseItem } from "@shared/schema";
import { resolveColorVar, hslColor } from "./shared";
import { CourseContent } from "./CourseSelectorSolid";
import { getIcon } from "@/lib/icons";
import { IconClock, IconArrowRight, IconCheck } from "@tabler/icons-react";
import { useInternalNav } from "@/hooks/useInternalNav";
import type { ResolvedColor } from "./shared";

interface CourseSelectorSpotlightProps {
  data: CourseSelectorSection;
}

function SmallCourseCard({ course }: { course: CourseItem }) {
  const resolved: ResolvedColor = useMemo(
    () => resolveColorVar(course.course_background),
    [course.course_background]
  );
  const handleLinkClick = useInternalNav();
  const Icon = course.icon ? getIcon(course.icon) : null;

  return (
    <div
      className="rounded-xl border relative overflow-hidden flex flex-col"
      data-testid={`card-course-small-${course.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: hslColor(resolved, 0.06) }}
      />
      <div className="relative z-10 p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            data-testid="text-duration"
          >
            <IconClock className="w-4 h-4" />
            {course.duration}
          </span>
          {course.label && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-border"
              style={{ backgroundColor: hslColor(resolved, 0.4) }}
              data-testid="badge-label"
            >
              <IconCheck className="w-3.5 h-3.5" />
              {course.label}
            </span>
          )}
        </div>

        <h3
          className="text-lg font-bold text-foreground leading-tight flex items-center gap-2"
          data-testid="text-course-title"
        >
          {Icon && <Icon className="w-5 h-5 shrink-0" style={{ color: hslColor(resolved, 1) }} />}
          {course.title}
        </h3>

        {course.badges && course.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="container-badges">
            {course.badges.map((badge, i) => {
              const BadgeIcon = getIcon(badge.icon);
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: hslColor(resolved, 0.4) }}
                  data-testid={`badge-course-${i}`}
                >
                  {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                  {badge.text}
                </span>
              );
            })}
          </div>
        )}

        <p
          className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1"
          data-testid="text-description"
        >
          {course.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 flex-wrap">
          {course.price && (
            <span className="font-bold text-foreground" data-testid="text-price">
              {course.price}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">
                {course.price_period || "/mo"}
              </span>
            </span>
          )}
          <a
            href={course.cta_url}
            onClick={handleLinkClick}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline ml-auto"
            data-testid="link-cta"
          >
            {course.cta_text}
            <IconArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function FeaturedCourseCard({ course }: { course: CourseItem }) {
  const resolved: ResolvedColor = useMemo(
    () => resolveColorVar(course.course_background),
    [course.course_background]
  );

  return (
    <div
      className="rounded-xl border relative overflow-hidden h-full"
      data-testid={`card-course-featured-${course.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: hslColor(resolved, 0.06) }}
      />
      <div className="relative z-10 p-6 md:p-8 h-full">
        <CourseContent course={course} resolved={resolved} />
      </div>
    </div>
  );
}

export function CourseSelectorSpotlight({ data }: CourseSelectorSpotlightProps) {
  const courses = data.courses;
  const featured = courses[0];
  const rest = courses.slice(1);

  if (!courses || courses.length === 0) return null;

  return (
    <section
      className="w-full py-12 md:py-16"
      data-testid="section-course-selector-spotlight"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {(data.heading || data.subheading) && (
          <div className="text-center mb-8 md:mb-12">
            {data.heading && (
              <h2
                className="text-3xl md:text-4xl font-bold text-foreground mb-3"
                data-testid="text-heading"
              >
                {data.heading}
              </h2>
            )}
            {data.subheading && (
              <div
                className="text-lg text-muted-foreground max-w-2xl mx-auto"
                data-testid="text-subheading"
                dangerouslySetInnerHTML={{ __html: data.subheading }}
              />
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-5">
          {featured && (
            <div className="w-full md:w-[38%] shrink-0">
              <FeaturedCourseCard course={featured} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="flex-1 flex flex-col gap-4">
              {rest.map((course) => (
                <SmallCourseCard key={course.name} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
