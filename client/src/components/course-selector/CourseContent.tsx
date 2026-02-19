import { useState, useRef, useEffect } from "react";
import type { CourseItem } from "@shared/schema";
import { getIcon } from "@/lib/icons";
import {
  IconArrowRight,
  IconClock,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { ResolvedColor } from "./shared";
import { hslColor } from "./shared";
import { useInternalNav } from "@/hooks/useInternalNav";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useVariableText } from "@/components/editing/VariableHighlight";

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
  const handleLinkClick = useInternalNav();
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
          <IconClock className="w-4 h-4" />
          {vt(course.duration)}
        </span>
        {course.label && (
          <span
            style={{
              backgroundColor: hslColor(resolved, 0.8),
            }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-border bg-background "
            data-testid="badge-label"
          >
            <IconCheck className="w-3.5 h-3.5" />
            {vt(course.label)}
          </span>
        )}
      </div>

      <h3
        className="text-3xl md:text-4xl font-bold text-foreground leading-tight flex items-center gap-3"
        data-testid="text-course-title"
      >
        {course.icon && (() => {
          const TitleIcon = getIcon(course.icon);
          return TitleIcon ? <TitleIcon className="w-8 h-8 md:w-10 md:h-10 shrink-0" /> : null;
        })()}
        {vt(course.title)}
      </h3>

      {course.subtitle && (
        <p className="text-xl" data-testid="text-subtitle">
          {vt(course.subtitle)}
        </p>
      )}
      <div className="flex items-center flex-wrap gap-2" data-testid="container-badges-tags">
        {course.badges && course.badges.map((badge, i) => (
          <CourseBadgeItem
            key={`badge-${i}`}
            icon={badge.icon}
            text={badge.text}
            resolved={resolved}
          />
        ))}
        {course.tags && course.tags.map((tag, i) => (
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
                {vt(course.original_price)}
              </span>
            )}
            <span
              className="text-4xl font-bold text-foreground"
              data-testid="text-price"
            >
              {vt(course.price)}
            </span>
            <span className="text-base text-muted-foreground">{course.price_period || "/mo"}</span>
          </div>
          {course.price_info && (
            <RichTextContent
              html={course.price_info}
              className="text-base text-muted-foreground [&_p]:mb-0"
              data-testid="text-price-info"
            />
          )}
        </div>
        <a href={course.cta_url} onClick={handleLinkClick} className="w-full md:w-auto" data-testid="link-cta">
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            {vt(course.cta_text)}
            <IconArrowRight className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}
