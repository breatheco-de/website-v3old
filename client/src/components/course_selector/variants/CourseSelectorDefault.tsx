
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ArrowRight, Check, ChevronDown, Clock } from "lucide-react";
import type { CourseSelectorSection, CourseItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { resolveColorVar, hslColor } from "../shared";
import { getIcon } from "@/lib/icons";
import type { ResolvedColor } from "../shared";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useVariableText } from "@/components/editing/VariableHighlight";

interface CourseSelectorDefaultProps {
  data: CourseSelectorSection;
}

function CourseBadgeItem({
  icon,
  text,
  resolved,
}: {
  icon: string;
  text: string;
  resolved: ResolvedColor;
}) {
  const IconComp = getIcon(icon);
  const vt = useVariableText();
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-base font-medium"
      style={{
        backgroundColor: hslColor(resolved, 1),
      }}
      data-testid="badge-course"
    >
      {IconComp && <IconComp className="w-4 h-4" />}
      {vt(text)}
    </span>
  );
}

function CourseTagItem({ icon, text }: { icon: string; text: string }) {
  const IconComp = getIcon(icon);
  const vt = useVariableText();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      data-testid="tag-course"
    >
      {IconComp && <IconComp className="w-4 h-4" />}
      {vt(text)}
    </span>
  );
}

export function CourseContent({
  course,
  resolved,
}: {
  course: CourseItem;
  resolved: ResolvedColor;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const vt = useVariableText();

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight);
    }
  }, [course.description, expanded]);

  return (
    <div className="flex flex-col h-full gap-4 relative z-10" data-var-react-owner>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-sm md:text-base text-muted-foreground"
          data-testid="text-duration"
        >
          <Clock className="w-4 h-4" />
          {vt(course.duration)}
        </span>
        {course.label && (
          <span
            style={{
              backgroundColor: hslColor(resolved, 0.8),
              border: "1px solid " + hslColor(resolved, 0.5),
            }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-background "
            data-testid="badge-label"
          >
            <Check className="w-3.5 h-3.5" />
            {vt(course.label)}
          </span>
        )}
      </div>

      <h3
        className="text-3xl md:text-4xl font-bold text-foreground leading-tight flex items-center gap-3"
        data-testid="text-course-title"
      >
        {course.icon &&
          (() => {
            const TitleIcon = getIcon(course.icon);
            return TitleIcon ? (
              <TitleIcon className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
            ) : null;
          })()}
        {vt(course.title)}
      </h3>

      {course.subtitle && (
        <p className="text-xl" data-testid="text-subtitle">
          {vt(course.subtitle)}
        </p>
      )}
      <div
        className="flex items-center flex-wrap gap-2"
        data-testid="container-badges-tags"
      >
        {course.badges &&
          course.badges.map((badge, i) => (
            <CourseBadgeItem
              key={`badge-${i}`}
              icon={badge.icon}
              text={badge.text}
              resolved={resolved}
            />
          ))}
        {course.tags &&
          course.tags.map((tag, i) => (
            <CourseTagItem key={`tag-${i}`} icon={tag.icon} text={tag.text} />
          ))}
      </div>

      <div className="relative mt-2 md:mt-0 md:me-28 lg:me-40">
        <p
          ref={descRef}
          className={`text-sm md:text-base text-muted-foreground leading-relaxed ${
            !expanded ? "line-clamp-5 md:line-clamp-none" : ""
          }`}
          data-testid="text-description"
        >
          {vt(course.description)}
        </p>
        {!expanded && isClamped && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="md:hidden mt-1 text-sm font-medium text-primary inline-flex items-center gap-0.5"
            data-testid="button-see-more"
          >
            See more
            <ChevronDown className="w-3.5 h-3.5" />
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
                {vt(course.original_price)}
              </span>
            )}
            <span
              className="text-4xl font-bold text-foreground"
              data-testid="text-price"
            >
              {vt(course.price)}
            </span>
            {course.price && (
              <span className="text-base text-muted-foreground">
                {course.price_period || "/mo"}
              </span>
            )}
          </div>

          {course.price_info && (
            <RichTextContent
              html={course.price_info}
              className="text-base text-muted-foreground [&_p]:mb-0"
              data-testid="text-price-info"
            />
          )}
        </div>
        <a
          href={course.cta_url}
          className="w-full md:w-auto"
          data-testid="link-cta"
        >
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            {vt(course.cta_text)}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

export default function CourseSelectorDefault({ data }: CourseSelectorDefaultProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const courses = data.courses;
  const activeCourse = courses[activeIndex];

  const resolved = useMemo(() => {
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
          className="rounded-2xl border overflow-hidden flex flex-col md:flex-row min-h-[420px]"
          data-testid="card-course-selector"
        >
          <div className="md:w-[280px] lg:w-[360px] shrink-0 bg-card flex flex-col">
            {courses.map((course, index) => {
              const isActive = index === activeIndex;
              return (
                <Button
                  variant="ghost"
                  key={index}
                  onClick={() => handleTabClick(index)}
                  className={`
                    relative text-left px-5 py-4 m-2 transition-colors duration-200
                    flex items-center justify-between gap-2 rounded-xl
                    ${
                      isActive
                        ? "font-semibold text-foreground bg-gray-100"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  data-testid={`button-tab-${index}`}
                >
                  <span className="text-sm md:text-lg">{course.name}</span>
                  {isActive && (
                    <ArrowRight className="w-4 h-4 shrink-0 hidden md:block" />
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
                background: `linear-gradient(150deg, ${hslColor(resolved, 0.6)} 0%, ${hslColor(resolved, 0.2)} 70%, transparent 90%)`,
                borderColor: hslColor(resolved, 2.5),
              }}
            />
            <div
              className="absolute inset-0 transition-all duration-500 hidden md:block border-t-8"
              style={{
                background: `linear-gradient(180deg, ${hslColor(resolved, 0.5)} 0%, ${hslColor(resolved, 0.15)} 90%, transparent 100%)`,
                borderColor: hslColor(resolved, 1),
              }}
            />
            {activeCourse && (
              <CourseContent key={activeIndex} course={activeCourse} resolved={resolved} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
