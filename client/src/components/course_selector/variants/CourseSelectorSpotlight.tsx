
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { CourseSelectorSection, CourseItem } from "@shared/schema";
import { resolveColorVar, hslColor } from "../shared";
import { getIcon } from "@/lib/icons";
import { useInternalNav } from "@/hooks/useInternalNav";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useVariableText } from "@/components/editing/VariableHighlight";
import type { ResolvedColor } from "../shared";
import { DotsIndicator } from "@/components/DotsIndicator";
import { Button } from "@/components/ui/button";

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
  const resolved: ResolvedColor = resolveColorVar(course.course_background);
  const handleLinkClick = useInternalNav();
  const Icon = course.icon ? getIcon(course.icon) : null;
  const vt = useVariableText();

  return (
    <div
      className="rounded-xl  relative overflow-hidden h-full flex flex-col"
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
            <Clock className="w-3.5 h-3.5" />
            {vt(course.duration)}
          </span>
          {course.label && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-border"
              style={{ backgroundColor: hslColor(resolved, 0.4) }}
              data-testid="badge-label"
            >
              <Check className="w-3 h-3" />
              {vt(course.label)}
            </span>
          )}
        </div>

        <h3
          className="text-[1.7rem] md:text-3xl font-bold text-foreground leading-tight"
          data-testid="text-course-title"
        >
          {Icon && (
            <Icon
              className="inline-block w-6 h-6 mr-2 align-middle"
              style={{ color: hslColor(resolved, 1) }}
            />
          )}
          <span>{vt(course.title)}</span>
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
          className="text-sm md:text-base text-muted-foreground leading-relaxed flex-1"
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
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function SmallCourseCard({ course }: { course: CourseItem }) {
  const resolved: ResolvedColor = resolveColorVar(course.course_background);
  const handleLinkClick = useInternalNav();
  const Icon = course.icon ? getIcon(course.icon) : null;
  const vt = useVariableText();

  return (
    <div
      className="rounded-xl relative overflow-hidden h-full flex flex-col"
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
              <Check className="w-3 h-3" />
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
          className="text-[13px] md:text-sm text-muted-foreground leading-relaxed line-clamp-3 md:line-clamp-2"
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
            <Clock className="w-3.5 h-3.5" />
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
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CourseSelectorSpotlight({ data }: CourseSelectorSpotlightProps) {
  const courses = data.courses;
  const featured = courses[0];
  const rest = courses.slice(1);
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const mobileViewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const swipeDeltaXRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);

  if (!courses || courses.length === 0) return null;

  const maxMobileIndex = courses.length - 1;

  const goToCourse = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, maxMobileIndex));
    setActiveMobileIndex(clampedIndex);
  };

  const resetTouchState = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    swipeDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = false;
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    swipeDeltaXRef.current = 0;
    isHorizontalSwipeRef.current = false;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || touchStartXRef.current === null || touchStartYRef.current === null) return;

    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      isHorizontalSwipeRef.current = true;
    }

    event.preventDefault();
    swipeDeltaXRef.current = deltaX;
  };

  const handleTouchEnd = () => {
    if (!isHorizontalSwipeRef.current) {
      resetTouchState();
      return;
    }

    const viewportWidth = mobileViewportRef.current?.offsetWidth ?? 0;
    const swipeThreshold = Math.max(viewportWidth * 0.18, 48);
    const finalOffset = swipeDeltaXRef.current;

    if (finalOffset <= -swipeThreshold && activeMobileIndex < maxMobileIndex) {
      goToCourse(activeMobileIndex + 1);
    } else if (finalOffset >= swipeThreshold && activeMobileIndex > 0) {
      goToCourse(activeMobileIndex - 1);
    }

    resetTouchState();
  };

  useEffect(() => {
    setActiveMobileIndex(0);
  }, [courses.length]);

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

        <div className="md:hidden">
          <div
            ref={mobileViewportRef}
            className="-mx-4 overflow-hidden px-4 pb-2"
            style={{ touchAction: "pan-y" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            data-testid="mobile-course-selector-carousel"
          >
            <div
              className="flex items-stretch transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeMobileIndex * 100}%)` }}
            >
              {courses.map((course) => (
                <div
                  key={course.name}
                  className="flex w-full shrink-0"
                >
                  <div className="mx-auto flex w-[88%] sm:w-[72%]">
                    <FeaturedCourseCard course={course} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {courses.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3" data-testid="mobile-course-selector-controls">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full border-0 shadow-none hover:bg-muted"
                onClick={() => goToCourse(activeMobileIndex - 1)}
                disabled={activeMobileIndex === 0}
                aria-label="Previous course"
                data-testid="button-course-selector-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <DotsIndicator
                count={courses.length}
                activeIndex={activeMobileIndex}
                onDotClick={goToCourse}
                ariaLabel="Course selector indicators"
              />

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full border-0 shadow-none hover:bg-muted"
                onClick={() => goToCourse(activeMobileIndex + 1)}
                disabled={activeMobileIndex === courses.length - 1}
                aria-label="Next course"
                data-testid="button-course-selector-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="hidden md:flex md:flex-row items-stretch gap-5">
          {featured && (
            <div className="flex w-full md:w-[38%] shrink-0">
              <FeaturedCourseCard course={featured} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="flex-1 flex flex-col gap-4">
              {rest.map((course) => (
                <div key={course.name} className="flex-1">
                  <SmallCourseCard course={course} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
