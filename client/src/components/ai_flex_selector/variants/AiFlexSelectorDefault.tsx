import { useState, useEffect, useMemo, type CSSProperties } from "react";
import Marquee from "react-fast-marquee";
import { Button } from "@/components/ui/button";
import { getIcon } from "@/lib/icons";
import { useInternalNav } from "@/hooks/useInternalNav";
import type { AiFlexSelectorDefault } from "@shared/schema";

// ─── Path matching ─────────────────────────────────────────────────────────────
// Matches question/option positions defined in the example YAML:
// Q0=goal      (0:productivity, 1:automate, 2:build, 3:data)
// Q1=coding    (0:no-keep, 1:no-open, 2:some, 3:regular)
// Q2=impact    (0:reliable, 1:automations, 2:assistant, 3:code, 4:data_skills)
// Q3=use       (0:better, 1:add, 2:career_shift, 3:explore)
// Path order in YAML: 0=Data-Driven, 1=Builder, 2=Career Switcher, 3=Automation, 4=AI-First (fallback)
function getPathIndex(answers: Record<number, number>, pathCount: number): number {
  const q0 = answers[0];
  const q1 = answers[1];
  const q2 = answers[2];
  const q3 = answers[3];
  if (q0 === 3 || q2 === 4) return 0;
  if (q0 === 2 || (q1 === 3 && q3 === 2)) return Math.min(1, pathCount - 1);
  if (q1 === 3 || q3 === 2) return Math.min(2, pathCount - 1);
  if (q0 === 1 || q2 === 1) return Math.min(3, pathCount - 1);
  return pathCount - 1;
}

// ─── SkillBar ──────────────────────────────────────────────────────────────────
function SkillBar({ name, skill_percentage, animate }: { name: string; skill_percentage: number; animate: boolean }) {
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setWidth(skill_percentage), 60);
      return () => clearTimeout(t);
    } else {
      setWidth(0);
    }
  }, [animate, skill_percentage]);

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`text-[11px] whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 ${hovered ? "text-foreground" : "text-muted-foreground/50"}`}
        style={{ minWidth: 120 }}
      >
        {name}
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden bg-muted transition-all duration-150"
        style={{ height: hovered ? 6 : 4 }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: "hsl(var(--primary))",
            transitionProperty: "width",
            transitionDuration: "650ms",
            transitionTimingFunction: "cubic-bezier(.4,0,.2,1)",
          }}
        />
      </div>
      <span
        className={`text-[10px] tabular-nums transition-colors duration-150 ${hovered ? "text-muted-foreground" : "text-muted-foreground/30"}`}
        style={{ minWidth: 26, textAlign: "right" }}
      >
        {skill_percentage}%
      </span>
    </div>
  );
}

// ─── CourseCard ────────────────────────────────────────────────────────────────
type Course = AiFlexSelectorDefault["courses"][0];

function CourseCard({
  course,
  isSelected,
  skillsLabel,
  onToggle,
}: {
  course: Course;
  isSelected: boolean;
  skillsLabel: string;
  onToggle: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-[13px] border-[1.5px] cursor-pointer select-none transition-all duration-200 ${
        isSelected ? "border-primary" : "border-border opacity-60 hover:opacity-100"
      }`}
      style={{
        background: isSelected ? "hsl(var(--primary) / 0.05)" : "hsl(var(--muted) / 0.4)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 3px 10px rgba(0,0,0,0.03)",
        transition: "border-color .2s, box-shadow .2s, transform .18s, opacity .2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.08), 0 8px 22px rgba(0,0,0,0.05)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 3px 10px rgba(0,0,0,0.03)";
        e.currentTarget.style.transform = "none";
      }}
      onClick={() => onToggle(course.name)}
    >
      <div className="flex items-start gap-[10px] p-[13px] pb-[10px]">
        <div
          className="w-5 h-5 rounded-full flex-shrink-0 mt-px flex items-center justify-center transition-all duration-150"
          style={{
            background: isSelected ? "hsl(var(--primary))" : "transparent",
            boxShadow: isSelected ? "none" : "0 0 0 1.8px hsl(var(--border))",
          }}
        >
          <div
            className="w-[7px] h-[7px] rounded-full bg-background transition-all duration-200"
            style={{ opacity: isSelected ? 1 : 0, transform: isSelected ? "scale(1)" : "scale(0.4)" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] font-bold leading-[1.3] mb-[2px] transition-colors ${isSelected ? "text-foreground" : "text-muted-foreground/60"}`}>
            {course.name}
          </div>
          <div className={`text-[12px] leading-[1.4] transition-colors ${isSelected ? "text-primary/60" : "text-muted-foreground/40"}`}>
            {course.tagline}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground/50 bg-muted px-[7px] py-[2px] rounded-full font-semibold whitespace-nowrap flex-shrink-0">
          {course.hrs}
        </div>
      </div>

      <div
        className="flex items-center gap-[4px] px-[13px] pb-[10px] pt-[14px] mt-[-14px] w-full"
        onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
      >
        <span className="text-[11px] font-bold tracking-[0.07em] uppercase text-primary">
          {skillsLabel}
        </span>
        <span
          className="text-[18px] leading-none text-primary transition-transform duration-200"
          style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </div>

      <div
        className="border-t border-border overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? 160 : 0 }}
        onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
      >
        <div className="px-[13px] pt-[10px] pb-[13px] flex flex-col gap-2">
          {course.skills.map((s) => (
            <SkillBar key={s.name} name={s.name} skill_percentage={s.skill_percentage} animate={expanded} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AiFlexSelectorDefault({ data }: { data: AiFlexSelectorDefault }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [animating, setAnimating] = useState(false);
  const [slideDir, setSlideDir] = useState<"none" | "exit-fwd" | "enter-fwd" | "exit-back" | "enter-back">("none");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [counterFlash, setCounterFlash] = useState(false);
  const nav = useInternalNav();

  const totalQ = data.questions.length;
  const isResults = step >= totalQ;
  const pathIdx = isResults ? getPathIndex(answers, data.paths.length) : -1;
  const currentPath = pathIdx >= 0 ? data.paths[pathIdx] : null;

  const courseByName = useMemo(
    () => Object.fromEntries(data.courses.map((c) => [c.name, c])),
    [data.courses]
  );

  useEffect(() => {
    if (isResults && currentPath) {
      setSelectedCourses(new Set(currentPath.courses));
    }
  }, [isResults, pathIdx]);

  // Tools: merge from currently selected courses (reactive)
  const currentTools = useMemo(() => {
    const seen = new Set<string>();
    const tools: string[] = [];
    selectedCourses.forEach((name) => {
      const course = courseByName[name];
      if (course) {
        course.tools.forEach((t) => {
          if (!seen.has(t)) { seen.add(t); tools.push(t); }
        });
      }
    });
    return tools;
  }, [selectedCourses, courseByName]);

  // Courses sorted: recommended first, then the rest
  const sortedCourses = useMemo(() => {
    if (!currentPath) return data.courses;
    const rec = new Set(currentPath.courses);
    return [
      ...data.courses.filter((c) => rec.has(c.name)),
      ...data.courses.filter((c) => !rec.has(c.name)),
    ];
  }, [data.courses, currentPath]);

  function runAnimation(dir: "fwd" | "back", action: () => void) {
    if (animating) return;
    setAnimating(true);
    setSlideDir(dir === "fwd" ? "exit-fwd" : "exit-back");
    setTimeout(() => {
      action();
      setSlideDir(dir === "fwd" ? "enter-fwd" : "enter-back");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSlideDir("none");
          setAnimating(false);
        })
      );
    }, 200);
  }

  function pick(qIdx: number, optIdx: number) {
    const newAnswers = { ...answers, [qIdx]: optIdx };
    setAnswers(newAnswers);
    runAnimation("fwd", () => setStep((s) => s + 1));
  }

  function goBack() {
    if (step === 0) return;
    runAnimation("back", () => setStep((s) => s - 1));
  }

  function restart() {
    runAnimation("back", () => {
      setStep(0);
      setAnswers({});
      setSelectedCourses(new Set());
    });
  }

  function toggleCourse(name: string) {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        if (next.size >= data.max_selections) {
          setCounterFlash(true);
          setTimeout(() => setCounterFlash(false), 800);
          return prev;
        }
        next.add(name);
      }
      return next;
    });
  }

  const slideStyle: CSSProperties =
    slideDir === "exit-fwd" ? { opacity: 0, transform: "translateX(-16px)", transition: "opacity .2s, transform .2s" }
    : slideDir === "enter-fwd" ? { opacity: 0, transform: "translateX(16px)" }
    : slideDir === "exit-back" ? { opacity: 0, transform: "translateX(16px)", transition: "opacity .2s, transform .2s" }
    : slideDir === "enter-back" ? { opacity: 0, transform: "translateX(-16px)" }
    : { opacity: 1, transform: "none", transition: "opacity .2s, transform .2s" };

  const RobotIcon = data.icon ? getIcon(data.icon) : null;

  const useTwoRows = currentTools.length > 8;
  const mid = Math.ceil(currentTools.length / 2);
  const toolsRow1 = useTwoRows ? currentTools.slice(0, mid) : currentTools;
  const toolsRow2 = useTwoRows ? currentTools.slice(mid) : [];

  const toolBadgeBase: CSSProperties = {
    fontFamily: "'SF Mono','Fira Code',monospace",
    fontSize: "14px",
    fontWeight: 600,
    borderRadius: "9999px",
    padding: "7px 16px",
    whiteSpace: "nowrap",
    flexShrink: 0,
    cursor: "default",
    background: "hsl(var(--background))",
    color: "hsl(var(--muted-foreground))",
    marginRight: 7,
  };

  const maskStyle: CSSProperties = {
    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
    maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 pb-16">
      <div className="max-w-[1120px] mx-auto">

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-bold tracking-[0.08em] uppercase px-[13px] py-[5px] rounded-full mb-5">
          {data.badge_text}
        </div>

        {/* Title */}
        <h1 className="text-[36px] font-extrabold text-foreground tracking-[-0.025em] leading-[1.1] mb-[0.6rem]">
          {data.title}<br />
          <span className="text-primary">{data.title_highlight}</span>
        </h1>
        <p className="text-[15px] text-muted-foreground leading-[1.6] mb-8">
          {data.subtitle}
        </p>

        {/* Progress bars */}
        <div className="flex gap-[8px] mb-9">
          {data.questions.map((_, i) => (
            <div
              key={i}
              className="h-[2.5px] flex-1 rounded-full"
              style={{
                transition: "background .4s",
                background:
                  i < step ? "hsl(var(--primary))"
                  : i === step && !isResults ? "hsl(var(--primary) / 0.35)"
                  : "hsl(var(--border))",
              }}
            />
          ))}
        </div>

        {/* ── QUIZ ────────────────────────────────────────────────────────── */}
        {!isResults && (
          <div style={slideStyle} className="relative mx-28">
            {RobotIcon && (
              <div className="absolute pointer-events-none" style={{ right: "calc(100% + 9px)", top: "-19px" }}>
                <RobotIcon width="85px" height="85px" color="hsl(var(--foreground))" />
              </div>
            )}

            <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-muted-foreground/50 mb-1">
              {data.questions[step].subtitle}
            </div>
            <div className="text-[20px] font-bold text-foreground leading-[1.25] mb-6 tracking-[-0.01em]">
              {data.questions[step].text}
            </div>

            <div className="flex flex-col gap-2">
              {data.questions[step].options.map((opt, optIdx) => {
                const sel = answers[step] === optIdx;
                return (
                  <button
                    key={optIdx}
                    className="flex items-center gap-[14px] px-4 py-[13px] border-[1.5px] rounded-[12px] cursor-pointer text-left w-full transition-all duration-200"
                    style={{
                      borderColor: sel ? "hsl(var(--primary))" : "hsl(var(--border))",
                      background: sel ? "hsl(var(--primary) / 0.08)" : "hsl(var(--background))",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                    onMouseEnter={(e) => {
                      if (!sel) {
                        e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.4)";
                        e.currentTarget.style.background = "hsl(var(--primary) / 0.03)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!sel) {
                        e.currentTarget.style.borderColor = "hsl(var(--border))";
                        e.currentTarget.style.background = "hsl(var(--background))";
                        e.currentTarget.style.transform = "none";
                      }
                    }}
                    onClick={() => pick(step, optIdx)}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-200"
                      style={{
                        background: sel ? "hsl(var(--primary))" : "transparent",
                        borderColor: sel ? "hsl(var(--primary))" : "hsl(var(--border))",
                      }}
                    >
                      <div
                        className="w-[7px] h-[7px] rounded-full bg-background transition-all duration-200"
                        style={{ opacity: sel ? 1 : 0, transform: sel ? "scale(1)" : "scale(0.4)" }}
                      />
                    </div>
                    <span className={`text-[14px] flex-1 font-medium leading-[1.4] ${sel ? "text-primary" : "text-foreground/70"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {step > 0 && (
              <div className="w-full mt-4 flex justify-start">
                <button
                  className="text-[13px] font-medium text-muted-foreground/50 bg-transparent border-none cursor-pointer flex items-center gap-1.5 hover:text-muted-foreground transition-colors duration-150 px-0"
                  onClick={goBack}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {data.back_label}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS ─────────────────────────────────────────────────────── */}
        {isResults && currentPath && (
          <div style={slideStyle} className="relative mx-28">
            {RobotIcon && (
              <div className="absolute pointer-events-none" style={{ right: "calc(100% + 9px)", top: "-16px" }}>
                <RobotIcon width="85px" height="85px" color="hsl(var(--foreground))" />
              </div>
            )}

            <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-muted-foreground/50">
              {data.results.ready_label}
            </div>
            <div className="text-[30px] font-extrabold text-foreground tracking-[-0.03em] leading-[1.1] mb-[0.6rem]">
              {currentPath.name}
            </div>
            <div className="text-[13px] text-muted-foreground/50 mb-6">
              {currentPath.tagline}
            </div>

            {/* Counter row */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-muted-foreground/50">
                {data.results.subtitle}
              </div>
              <div
                className="text-[11px] font-bold px-[10px] py-[3px] rounded-full border transition-all duration-300"
                style={{
                  color: counterFlash ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                  background: counterFlash ? "hsl(var(--destructive) / 0.08)" : "hsl(var(--primary) / 0.08)",
                  borderColor: counterFlash ? "hsl(var(--destructive) / 0.3)" : "hsl(var(--primary) / 0.2)",
                }}
              >
                {selectedCourses.size} / {data.max_selections} {data.results.counter_label}
              </div>
            </div>

            {/* Course grid */}
            <div className="grid grid-cols-2 gap-[9px] items-start">
              {sortedCourses.map((course) => (
                <CourseCard
                  key={course.name}
                  course={course}
                  isSelected={selectedCourses.has(course.name)}
                  skillsLabel={data.skills_breakdown_label}
                  onToggle={toggleCourse}
                />
              ))}
            </div>

            {/* Restart */}
            <button
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground/40 mt-3 underline cursor-pointer bg-transparent border-none hover:text-muted-foreground transition-colors duration-150"
              onClick={restart}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 10L4 6L8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {data.restart_label}
            </button>

            {/* Tools marquee / badges */}
            {currentTools.length > 0 && (
              <div className="mt-[27px]">
                <div className="text-[14px] font-bold tracking-[0.09em] uppercase text-muted-foreground/40 mb-3 text-center">
                  {data.results.tools_label}
                </div>

                {data.tools_marquee ? (
                  <div className="flex flex-col gap-[5px]">
                    <div className="mx-[60px]" style={maskStyle}>
                      <Marquee speed={40} pauseOnHover gradient={false}>
                        {toolsRow1.map((tool) => (
                          <span key={tool} style={toolBadgeBase}>{tool}</span>
                        ))}
                      </Marquee>
                    </div>
                    {useTwoRows && (
                      <div style={maskStyle}>
                        <Marquee speed={40} pauseOnHover direction="right" gradient={false}>
                          {toolsRow2.map((tool) => (
                            <span key={tool} style={toolBadgeBase}>{tool}</span>
                          ))}
                        </Marquee>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-[7px] justify-center">
                    {currentTools.map((tool) => (
                      <span
                        key={tool}
                        className="transition-colors duration-150 cursor-default hover:bg-primary/10 hover:text-primary"
                        style={toolBadgeBase}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {data.cta.banner ? (
              <div className="bg-primary rounded-[13px] px-[1.4rem] py-[1.2rem] flex items-center justify-between gap-4 shadow-[0_4px_16px_rgba(0,0,0,0.15)] mt-[35px]">
                <div>
                  <div className="text-[15px] font-bold text-primary-foreground mb-[2px]">
                    {data.cta.title}
                  </div>
                  <div className="text-[12px] text-primary-foreground/60">
                    {data.cta.subtitle}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {data.cta.buttons.map((btn, i) => (
                    <Button key={i} variant="secondary" className="whitespace-nowrap" onClick={() => nav(btn.url)}>
                      {btn.text}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 mt-[35px]">
                <div className="flex gap-2 flex-shrink-0">
                  {data.cta.buttons.map((btn, i) => (
                    <Button key={i} variant="default" className="whitespace-nowrap" onClick={() => nav(btn.url)}>
                      {btn.text}
                    </Button>
                  ))}
                </div>
                <div>
                  <div className="text-[15px] font-bold text-foreground mb-[2px]">
                    {data.cta.title}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {data.cta.subtitle}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
