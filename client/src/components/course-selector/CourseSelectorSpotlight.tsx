import { useMemo } from "react";
import type { CourseSelectorSection, CourseItem } from "@shared/schema";
import { resolveColorVar, hslColor } from "./shared";
import { getIcon } from "@/lib/icons";
import {
  IconClock,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react";
import { useInternalNav } from "@/hooks/useInternalNav";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useVariableText } from "@/components/editing/VariableHighlight";
import type { ResolvedColor } from "./shared";

interface CourseSelectorSpotlightProps {
  data: CourseSelectorSection;
}

function SpotlightTagItem({ icon, text }: { icon: string; text: string }) {
  const IconComp = getIcon(icon);
  const vt = useVariableText();
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      data-testid="tag-course"
    >
      {IconComp && <IconComp className="w-3 h-3" />}
      {vt(text)}
    </span>
  );
}

function FeaturedCourseCard({ course }: { course: CourseItem }) {
  const resolved: ResolvedColor = useMemo(
    () => resolveColorVar(course.course_background),
    [course.course_background]
  );
  const handleLinkClick = useInternalNav();
  const Icon = course.icon ? getIcon(course.icon) : null;
  const vt = useVariableText();

  return (
    <div
      className="rounded-xl relative overflow-hidden h-full flex flex-col"
      data-testid={`card-course-featured-${course.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: hslColor(resolved, 0.06) }}
      />
      <div className="relative z-10 p-6 flex flex-col gap-4 h-full" data-var-react-owner>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="text-duration"
          >
            <IconClock className="w-3.5 h-3.5" />
            {vt(course.duration)}
          </span>
          {course.label && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-border"
              style={{ backgroundColor: hslColor(resolved, 0.4) }}
              data-testid="badge-label"
            >
              <IconCheck className="w-3 h-3" />
              {vt(course.label)}
            </span>
          )}
        </div>

        <h3
          className="text-3xl font-bold text-foreground leading-tight flex items-center gap-2.5"
          data-testid="text-course-title"
        >
          {Icon && (
            <Icon
              className="w-6 h-6 shrink-0"
              style={{ color: hslColor(resolved, 1) }}
            />
          )}
          {vt(course.title)}
        </h3>

        {course.subtitle && (
          <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
            {vt(course.subtitle)}
          </p>
        )}

        {((course.badges && course.badges.length > 0) ||
          (course.tags && course.tags.length > 0)) && (
          <div className="flex flex-wrap gap-1.5" data-testid="container-badges-tags">
            {course.badges &&
              course.badges.map((badge, i) => {
                const BadgeIcon = getIcon(badge.icon);
                return (
                  <span
                    key={`badge-${i}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: hslColor(resolved, 0.5) }}
                    data-testid={`badge-course-${i}`}
                  >
                    {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                    {vt(badge.text)}
                  </span>
                );
              })}
            {course.tags &&
              course.tags.map((tag, i) => (
                <SpotlightTagItem key={`tag-${i}`} icon={tag.icon} text={tag.text} />
              ))}
          </div>
        )}

        <p
          className="text-base text-muted-foreground leading-relaxed flex-1"
          data-testid="text-description"
        >
          {vt(course.description)}
        </p>

        <div className="mt-auto lg:flex justify-between gap-1">
          <div>
            <div className="flex items-baseline gap-1.5" data-testid="container-pricing">
              {course.original_price && (
                <span
                  className="text-sm text-muted-foreground line-through"
                  data-testid="text-original-price"
                >
                  {vt(course.original_price)}
                </span>
              )}
              {course.price && (
                <>
                  <span
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-price"
                  >
                    {vt(course.price)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {course.price_period || "/mo"}
                  </span>
                </>
              )}
            </div>
            {course.price_info && (
              <RichTextContent
                html={course.price_info}
                className="text-xs text-muted-foreground [&_p]:mb-0"
                data-testid="text-price-info"
              />
            )}
          </div>
          
          <a
            href={course.cta_url}
            onClick={handleLinkClick}
            className="inline-flex items-end gap-1 text-sm font-semibold hover:underline mt-1"
            style={{ color: hslColor(resolved, 1) }}
            data-testid="link-cta"
          >
            {vt(course.cta_text)}
            <IconArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function SmallCourseCard({ course }: { course: CourseItem }) {
  const resolved: ResolvedColor = useMemo(
    () => resolveColorVar(course.course_background),
    [course.course_background]
  );
  const handleLinkClick = useInternalNav();
  const Icon = course.icon ? getIcon(course.icon) : null;
  const vt = useVariableText();

  return (
    <div
      className="rounded-xl relative overflow-hidden flex flex-col"
      data-testid={`card-course-small-${course.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: hslColor(resolved, 0.06) }}
      />
      <div className="relative z-10 p-5 flex flex-col gap-2.5" data-var-react-owner>
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-base font-bold text-foreground leading-tight flex items-center gap-1.5 flex-1 min-w-0"
            data-testid="text-course-title"
          >
            {Icon && (
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: hslColor(resolved, 1) }}
              />
            )}
            {vt(course.title)}
          </h3>
          {course.label && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-border shrink-0"
              style={{ backgroundColor: hslColor(resolved, 0.4) }}
              data-testid="badge-label"
            >
              <IconCheck className="w-3 h-3" />
              {vt(course.label)}
            </span>
          )}
        </div>

        {((course.badges && course.badges.length > 0) ||
          (course.tags && course.tags.length > 0)) && (
          <div className="flex flex-wrap gap-1.5" data-testid="container-badges-tags">
            {course.badges &&
              course.badges.map((badge, i) => {
                const BadgeIcon = getIcon(badge.icon);
                return (
                  <span
                    key={`badge-${i}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: hslColor(resolved, 0.4) }}
                    data-testid={`badge-course-${i}`}
                  >
                    {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                    {vt(badge.text)}
                  </span>
                );
              })}
            {course.tags &&
              course.tags.map((tag, i) => (
                <SpotlightTagItem key={`tag-${i}`} icon={tag.icon} text={tag.text} />
              ))}
          </div>
        )}

        <p
          className="text-sm text-muted-foreground leading-relaxed line-clamp-2"
          data-testid="text-description"
        >
          {vt(course.description)}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-1" data-testid="container-pricing">
            {course.original_price && (
              <span
                className="text-xs text-muted-foreground line-through"
                data-testid="text-original-price"
              >
                {vt(course.original_price)}
              </span>
            )}
            {course.price && (
              <>
                <span
                  className="text-lg font-bold text-foreground"
                  data-testid="text-price"
                >
                  {vt(course.price)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {course.price_period || "/mo"}
                </span>
              </>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            data-testid="text-duration"
          >
            <IconClock className="w-3.5 h-3.5" />
            {vt(course.duration)}
          </span>
          <a
            href={course.cta_url}
            onClick={handleLinkClick}
            className="inline-flex items-center gap-1 text-sm font-semibold hover:underline ml-auto"
            style={{ color: hslColor(resolved, 1) }}
            data-testid="link-cta"
          >
            {vt(course.cta_text)}
            <IconArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
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
      <div>
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
