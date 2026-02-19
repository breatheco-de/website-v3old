import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { CourseSelectorSection, CourseItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import {
  IconArrowRight,
  IconClock,
  IconCircleCheck,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInternalNav } from "@/hooks/useInternalNav";

const COLOR_MAP: Record<string, string> = {
  primary: "var(--primary)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  secondary: "var(--secondary)",
  destructive: "var(--destructive)",
  card: "var(--card)",
  background: "var(--background)",
  sidebar: "var(--sidebar-background)",
};

function resolveColorVar(color: string | undefined): string {
  if (!color) return "var(--primary)";
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  if (color.startsWith("hsl(") && color.endsWith(")"))
    return color.slice(4, -1);
  if (color.startsWith("var(") || color.startsWith("#")) return color;
  return "var(--primary)";
}

interface CourseSelectorProps {
  data: CourseSelectorSection;
}

function CourseBadgeItem({
  icon,
  text,
  colorVar,
}: {
  icon: string;
  text: string;
  colorVar: string;
}) {
  const IconComp = getIcon(icon);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-base font-medium"
      style={{
        backgroundColor: `hsl(${colorVar} / 0.3)`,
      }}
      data-testid="badge-course"
    >
      {IconComp && <IconComp className="w-4 h-4" />}
      {text}
    </span>
  );
}

function CourseTagItem({ icon, text }: { icon: string; text: string }) {
  const IconComp = getIcon(icon);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      data-testid="tag-course"
    >
      {IconComp && <IconComp className="w-4 h-4" />}
      {text}
    </span>
  );
}

function CourseContent({
  course,
  colorVar,
}: {
  course: CourseItem;
  colorVar: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const handleLinkClick = useInternalNav();
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight);
    }
  }, [course.description, expanded]);

  return (
    <div className="flex flex-col h-full gap-4 relative z-10">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-sm md:text-base text-muted-foreground"
          data-testid="text-duration"
        >
          <IconClock className="w-4 h-4" />
          {course.duration}
        </span>
        {course.label && (
          <span
            style={{
              backgroundColor: `hsl(${colorVar} / 0.15)`,
            }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-border bg-background "
            data-testid="badge-label"
          >
            <IconCheck className="w-3.5 h-3.5" />
            {course.label}
          </span>
        )}
      </div>

      <h3
        className="text-3xl md:text-4xl font-bold text-foreground leading-tight"
        data-testid="text-course-title"
      >
        {course.title}
      </h3>

      {course.subtitle && (
        <p className="text-xl" data-testid="text-subtitle">
          {course.subtitle}
        </p>
      )}
      <div className="flex items-center flex-wrap gap-2" data-testid="container-badges-tags">
        {course.badges && course.badges.map((badge, i) => (
          <CourseBadgeItem
            key={`badge-${i}`}
            icon={badge.icon}
            text={badge.text}
            colorVar={colorVar}
          />
        ))}
        {course.tags && course.tags.map((tag, i) => (
          <CourseTagItem key={`tag-${i}`} icon={tag.icon} text={tag.text} />
        ))}
      </div>

      <div className="relative mt-2 md:mt-0">
        <p
          ref={descRef}
          className={`text-sm md:text-base text-muted-foreground leading-relaxed ${
            !expanded ? "line-clamp-5 md:line-clamp-none" : ""
          }`}
          data-testid="text-description"
        >
          {course.description}
        </p>
        {!expanded && isClamped && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="md:hidden mt-1 text-sm font-medium text-primary inline-flex items-center gap-0.5"
            data-testid="button-see-more"
          >
            See more
            <IconChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-auto pt-1 md:pt-4">
        <div>
          <div className="flex items-baseline" data-testid="container-pricing">
            {course.original_price && (
              <span
                className="text-base text-muted-foreground line-through me-2"
                data-testid="text-original-price"
              >
                {course.original_price}
              </span>
            )}
            <span
              className="text-4xl font-bold text-foreground"
              data-testid="text-price"
            >
              {course.price}
            </span>
            <span className="text-base text-muted-foreground">/mo</span>
          </div>
          {course.price_info && (
            <p
              className="text-base text-muted-foreground"
              data-testid="text-price-info"
            >
              {course.price_info}
            </p>
          )}
        </div>
        <a href={course.cta_url} onClick={handleLinkClick} className="w-full md:w-auto" data-testid="link-cta">
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            {course.cta_text}
            <IconArrowRight className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

export function CourseSelector({ data }: CourseSelectorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const courses = data.courses;
  const activeCourse = courses[activeIndex];

  const colorVar = useMemo(() => {
    return resolveColorVar(activeCourse?.course_background);
  }, [activeCourse?.course_background]);

  const handleTabClick = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (!courses || courses.length === 0) return null;

  return (
    <section
      className="w-full py-12 md:py-16"
      data-testid="section-course-selector"
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
              <p
                className="text-lg text-muted-foreground max-w-2xl mx-auto"
                data-testid="text-subheading"
              >
                {data.subheading}
              </p>
            )}
          </div>
        )}

        <div
          className="rounded-lg border overflow-hidden flex flex-col md:flex-row min-h-[420px]"
          data-testid="card-course-selector"
        >
          <div className="md:w-[280px] lg:w-[300px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
            {courses.map((course, index) => {
              const isActive = index === activeIndex;
              return (
                <Button
                  variant="ghost"
                  key={index}
                  onClick={() => handleTabClick(index)}
                  className={`
                    relative text-left px-5 py-4 transition-colors duration-200
                    flex items-center justify-between gap-2
                    w-full
                    ${
                      isActive
                        ? "font-semibold text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  data-testid={`button-tab-${index}`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full"
                      style={{ backgroundColor: `hsl(${colorVar})` }}
                    />
                  )}
                  <span className="text-sm md:text-lg">{course.name}</span>
                  {isActive && (
                    <IconArrowRight className="w-4 h-4 shrink-0 hidden md:block" />
                  )}
                </Button>
              );
            })}
          </div>

          <div className="flex-1 p-4 md:p-8 lg:p-10 relative overflow-hidden transition-all duration-500">
            <div className="absolute inset-0 bg-card" />
            <div
              className="absolute inset-0 transition-all duration-500 md:hidden border-t"
              style={{
                background: `linear-gradient(150deg, hsl(${colorVar} / 0.12) 0%, hsl(${colorVar} / 0.04) 70%, transparent 90%)`,
                borderColor: `hsl(${colorVar})`,
              }}
            />
            <div
              className="absolute inset-0 transition-all duration-500 hidden md:block border-l"
              style={{
                background: `linear-gradient(110deg, hsl(${colorVar} / 0.12) 0%, hsl(${colorVar} / 0.04) 50%, transparent 90%)`,
                borderColor: `hsl(${colorVar})`,
              }}
            />
            {activeCourse && (
              <CourseContent key={activeIndex} course={activeCourse} colorVar={colorVar} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CourseSelector;
