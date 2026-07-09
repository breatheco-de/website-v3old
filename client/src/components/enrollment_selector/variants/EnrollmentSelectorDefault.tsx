import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { UniversalImage } from "@/components/UniversalImage";
import { getIcon } from "@/lib/icons";
import { useInternalNav } from "@/hooks/useInternalNav";
import { IconChevronRight, IconCheck } from "@tabler/icons-react";
import type { EnrollmentSelectorDefault, EnrollmentSelectorProgram } from "@shared/schema";
import { addDays, addWeeks, addMonths } from "date-fns";

// ─── Date utils ───────────────────────────────────────────────────────────────

function advanceByInterval(d: Date, interval: number, unit: "days" | "weeks" | "months"): Date {
  if (unit === "days")  return addDays(d, interval);
  if (unit === "weeks") return addWeeks(d, interval);
  return addMonths(d, interval);
}

type DisplayDate = {
  label: string;
  year: string;
  note?: string;
  url?: string;
  date_iso: string;
};

function generateIntervalDates(
  startIso: string,
  interval: number,
  unit: "days" | "weeks" | "months",
  url?: string,
): DisplayDate[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let current = new Date(startIso + "T00:00:00");
  while (current <= today) {
    current = advanceByInterval(current, interval, unit);
  }
  const result: DisplayDate[] = [];
  for (let i = 0; i < 3; i++) {
    result.push({
      label: current.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
      year: String(current.getFullYear()),
      url,
      date_iso: current.toISOString().slice(0, 10),
    });
    current = advanceByInterval(current, interval, unit);
  }
  return result;
}

// ─── Selectable tile styles ───────────────────────────────────────────────────

function tileStyle(active: boolean, flashing: boolean): React.CSSProperties {
  return {
    borderColor: (active || flashing) ? "hsl(var(--primary) / 0.55)" : "transparent",
    boxShadow: (active || flashing)
      ? "0 3px 10px hsl(var(--primary) / 0.1), 0 8px 22px hsl(var(--primary) / 0.07)"
      : "none",
    opacity: active ? 1 : 0.88,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnrollmentSelectorDefault({ data }: { data: EnrollmentSelectorDefault }) {
  const nav = useInternalNav();

  const [selectedProgramIdx, setSelectedProgramIdx] = useState(0);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [filteredByQs, setFilteredByQs] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: read ?program and ?cohort from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const programQs = params.get("program");
    if (programQs) {
      const idx = data.programs.findIndex((p) => p.id === programQs);
      if (idx !== -1) {
        setSelectedProgramIdx(idx);
        setFilteredByQs(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const program = data.programs[selectedProgramIdx] ?? data.programs[0];
  const isDateMode = !!program?.dates;
  const isPlanMode = !isDateMode && !!(program?.plans?.length);

  // Build list of upcoming dates for date-mode
  const displayDates = useMemo<DisplayDate[]>(() => {
    if (!program?.dates) return [];
    if (program.dates.mode === "static") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return program.dates.items
        .filter((item) => new Date(item.date_iso + "T00:00:00") >= today)
        .sort((a, b) => a.date_iso.localeCompare(b.date_iso))
        .slice(0, 3)
        .map((item) => ({
          label:
            item.label ??
            new Date(item.date_iso + "T00:00:00").toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            }),
          year: item.year ?? String(new Date(item.date_iso + "T00:00:00").getFullYear()),
          note: item.note,
          url: item.url,
          date_iso: item.date_iso,
        }));
    }
    return generateIntervalDates(
      program.dates.start_date_iso,
      program.dates.interval,
      program.dates.interval_unit,
      program.dates.url,
    );
  }, [program]);

  // On mount: fire the URL of the first pre-selected date to set query params
  useEffect(() => {
    if (filteredByQs) return;
    const firstDate = displayDates[0];
    if (firstDate?.url) nav.navigate(firstDate.url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preselect date from ?cohort querystring once dates are resolved
  useEffect(() => {
    if (!isDateMode || !program?.dates || program.dates.mode !== "static") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cohortQs = params.get("cohort");
    if (!cohortQs) return;
    const matchIdx = program.dates.items.findIndex((item) => item.url?.includes(cohortQs));
    if (matchIdx !== -1) {
      const iso = program.dates.items[matchIdx].date_iso;
      const displayIdx = displayDates.findIndex((d) => d.date_iso === iso);
      if (displayIdx !== -1) setSelectedDateIdx(displayIdx);
    }
  }, [program, isDateMode, displayDates]);

  const plan = isPlanMode && program?.plans ? program.plans[selectedPlanIdx] : null;
  const activeSummary = plan?.summary ?? program?.summary;
  const activeBenefits = plan?.benefits?.length ? plan.benefits : (program?.benefits ?? []);
  const activeUnlocks = plan?.unlocks?.length ? plan.unlocks : (program?.unlocks ?? []);

  function triggerFlash(id: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashId(id);
    flashTimer.current = setTimeout(() => setFlashId(null), 220);
  }

  const sectionCls =
    "bg-card border border-border rounded-[0.8rem] p-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.05)]";
  const sectionClsLast =
    "bg-card border border-border rounded-[0.8rem] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.05)]";

  if (!program || !activeSummary) return null;

  const ctaVariantMap: Record<string, "default" | "secondary" | "outline"> = {
    primary: "default",
    secondary: "secondary",
    outline: "outline",
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_370px] gap-8 md:gap-12 items-start">

        {/* ── LEFT COLUMN ── */}
        <div>
          {data.eyebrow && (
            <p className="text-[10px] font-bold tracking-[2px] uppercase text-muted-foreground mb-2.5">
              {data.eyebrow}
            </p>
          )}

          <h1 className="font-inter font-black tracking-tight text-foreground leading-[1.1] mb-3">
            <div
              className="block md:hidden text-[38px] leading-[1.1]"
              dangerouslySetInnerHTML={{
                __html: (data.title || "")
                  .replace(/font-size\s*:[^;"]*(;)?/g, "")
                  .replace(/<br\s*\/?>/gi, " "),
              }}
            />
            <div
              className="hidden md:block leading-[1.1]"
              dangerouslySetInnerHTML={{ __html: data.title || "" }}
            />
          </h1>

          {data.description && (
            <p className="text-[14px] text-muted-foreground leading-relaxed mb-9">
              {data.description}
            </p>
          )}

          {/* PROGRAM SELECTOR or FILTERED HEADER */}
          {filteredByQs ? (
            <div className={sectionCls}>
              <ProgramFilteredHeader program={program} />
            </div>
          ) : data.programs.length > 1 ? (
            <div className={sectionCls}>
              <p className="text-[12px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3.5">
                {data.choose_program_label ?? "Choose your program"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {data.programs.map((prog, i) => {
                  const active = selectedProgramIdx === i;
                  const fid = `prog-${i}`;
                  const flashing = flashId === fid;
                  const ProgramIcon = prog.selection_card.icon
                    ? getIcon(prog.selection_card.icon)
                    : null;
                  return (
                    <button
                      key={prog.id}
                      data-testid={`button-program-${prog.id}`}
                      onClick={() => {
                        triggerFlash(fid);
                        setSelectedProgramIdx(i);
                        setSelectedDateIdx(0);
                        setSelectedPlanIdx(0);
                      }}
                      className="relative text-left rounded-[10px] p-3.5 border-[1.5px] outline-none cursor-pointer transition-[border-color,box-shadow,background,opacity] duration-200"
                      style={{
                        ...tileStyle(active, flashing),
                        background: active ? "hsl(var(--card))" : "hsl(var(--muted-foreground) / 0.04)",
                      }}
                    >
                      {active && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                      )}
                      <span
                        className="flex items-center gap-1.5 text-[15px] font-extrabold mb-1 pr-4 transition-colors duration-200"
                        style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
                      >
                        {ProgramIcon && <ProgramIcon size={16} />}
                        {prog.selection_card.name}
                      </span>
                      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground flex-wrap">
                        {prog.selection_card.duration}
                        {prog.selection_card.badge && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-px rounded-full whitespace-nowrap transition-colors duration-200"
                            style={{
                              background: active
                                ? "hsl(var(--primary) / 0.12)"
                                : "hsl(var(--primary) / 0.08)",
                              color: "hsl(var(--primary))",
                            }}
                          >
                            {prog.selection_card.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* DATE SELECTOR */}
          {isDateMode && displayDates.length > 0 && (
            <div className={sectionCls}>
              <p className="text-[12px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3.5">
                {data.choose_date_label ?? "Choose your start date"}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {displayDates.map((d, i) => {
                  const active = selectedDateIdx === i;
                  const fid = `date-${i}`;
                  const flashing = flashId === fid;
                  return (
                    <button
                      key={i}
                      data-testid={`button-date-${i}`}
                      onClick={() => {
                        triggerFlash(fid);
                        setSelectedDateIdx(i);
                        if (d.url) nav.navigate(d.url);
                      }}
                      className="text-center rounded-[10px] p-3 border-[1.5px] outline-none cursor-pointer transition-[border-color,box-shadow,background,opacity] duration-200"
                      style={{
                        ...tileStyle(active, flashing),
                        background: active ? "hsl(var(--card))" : "hsl(var(--muted-foreground) / 0.04)",
                      }}
                    >
                      <span
                        className="block text-[16px] font-extrabold mb-1 transition-colors duration-200"
                        style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
                      >
                        {d.label}
                      </span>
                      <span className="block text-[12px] font-medium text-muted-foreground">
                        {d.note ?? "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PLAN SELECTOR */}
          {isPlanMode && program.plans && (
            <div className={sectionCls}>
              <p className="text-[12px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3.5">
                {data.choose_plan_label ?? "Choose your plan"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {program.plans.map((p, i) => {
                  const active = selectedPlanIdx === i;
                  const fid = `plan-${i}`;
                  const flashing = flashId === fid;
                  return (
                    <button
                      key={p.id}
                      data-testid={`button-plan-${p.id}`}
                      onClick={() => {
                        triggerFlash(fid);
                        setSelectedPlanIdx(i);
                      }}
                      className="relative w-full text-left rounded-[12px] py-2.5 px-3.5 border-[1.5px] outline-none cursor-pointer transition-[border-color,box-shadow,background,opacity] duration-200"
                      style={{
                        ...tileStyle(active, flashing),
                        background: active ? "hsl(var(--card))" : "hsl(var(--muted-foreground) / 0.04)",
                      }}
                    >
                      {active && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                      )}
                      <div className="flex items-start justify-between gap-1 mb-1 pr-4">
                        <span
                          className="text-[15px] font-extrabold leading-tight transition-colors duration-200"
                          style={{
                            color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                          }}
                        >
                          {p.name}
                        </span>
                        {p.tag && (
                          <span
                            className="text-[8px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              background: p.featured
                                ? "hsl(var(--primary) / 0.12)"
                                : "hsl(var(--muted))",
                              color: p.featured
                                ? "hsl(var(--primary))"
                                : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {p.tag}
                          </span>
                        )}
                      </div>
                      {p.tagline && (
                        <p className="text-[11px] text-muted-foreground mb-2 leading-tight">
                          {p.tagline}
                        </p>
                      )}
                      <div className="flex items-end gap-px mb-0.5">
                        <span
                          className="text-[12px] font-extrabold mb-0.5 transition-colors duration-200"
                          style={{
                            color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                          }}
                        >
                          {p.currency}
                        </span>
                        <span
                          className="text-[26px] font-extrabold leading-none tracking-tight transition-colors duration-200"
                          style={{
                            color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                          }}
                        >
                          {p.amount}
                        </span>
                        <span className="text-[11px] ml-0.5 mb-0.5 font-medium text-muted-foreground">
                          {p.period}
                        </span>
                      </div>
                      {p.billing_note && (
                        <p className="text-[11px] text-muted-foreground">{p.billing_note}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BENEFITS */}
          {activeBenefits.length > 0 && (
            <div className={sectionClsLast}>
              <p className="text-[12px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-4">
                {data.included_label ?? "What's included"}
              </p>
              <div className="flex flex-col gap-3.5">
                {activeBenefits.map((b, i) => {
                  const BenefitIcon = b.icon ? getIcon(b.icon) : null;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "hsl(var(--color-green) / 0.15)" }}
                      >
                        {BenefitIcon ? (
                          <BenefitIcon
                            size={14}
                            style={{ color: "hsl(var(--color-green))" }}
                          />
                        ) : (
                          <IconCheck
                            size={14}
                            stroke={2.5}
                            style={{ color: "hsl(var(--color-green))" }}
                          />
                        )}
                      </span>
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">{b.title}</p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{b.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN (sticky) ── */}
        <div className="md:sticky md:top-[72px]">
          <div className="bg-card border border-border rounded-[0.8rem] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.05)]">

            {/* SUMMARY HEADER */}
            <div className="bg-primary px-5 py-5">
              <p
                className="text-[10px] font-bold tracking-[2px] uppercase mb-1.5"
                style={{ color: "hsl(var(--primary-foreground) / 0.6)" }}
              >
                {activeSummary.price_label}
              </p>
              <p className="font-inter text-[42px] font-extrabold leading-none tracking-tight mb-1 text-primary-foreground">
                {activeSummary.price_amount}
                {activeSummary.price_period && (
                  <span
                    className="text-[18px] font-bold ml-1"
                    style={{ color: "hsl(var(--primary-foreground) / 0.7)" }}
                  >
                    {activeSummary.price_period}
                  </span>
                )}
              </p>
              {activeSummary.price_sub && (
                <p
                  className="text-[12px]"
                  style={{ color: "hsl(var(--primary-foreground) / 0.6)" }}
                >
                  {activeSummary.price_sub}
                </p>
              )}
            </div>

            <div className="p-5">
              {/* SUMMARY ROWS */}
              <div className="flex flex-col divide-y divide-border mb-4">
                {activeSummary.rows.map((row, i) => {
                  let dynamicValue: string | null = null;
                  let accent = false;

                  if (row.show_dynamic_program && program) {
                    dynamicValue = program.selection_card.name;
                    accent = true;
                  } else if (row.show_dynamic_date) {
                    if (isDateMode && displayDates.length > 0) {
                      const d = displayDates[selectedDateIdx];
                      dynamicValue = d ? `${d.label}, ${d.year}` : "TBD";
                    } else if (isPlanMode && plan) {
                      dynamicValue = plan.name;
                    }
                  }

                  const isDynamic = dynamicValue !== null;
                  const value = dynamicValue ?? row.value ?? "";

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 text-[12px]"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      {isDynamic ? (
                        <span
                          className="font-semibold text-right text-[13px]"
                          style={{
                            color: accent
                              ? "hsl(var(--primary))"
                              : "hsl(var(--foreground))",
                          }}
                        >
                          {value}
                        </span>
                      ) : (
                        <RichTextContent
                          html={value}
                          className="font-semibold text-right text-[13px] text-foreground [&_p]:m-0 [&_p]:text-[13px] [&_p]:font-semibold [&_p]:leading-none max-w-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* UNLOCKS */}
              {activeUnlocks.length > 0 && (
                <div className="rounded-[0.8rem] p-3.5 mb-4" style={{ background: "hsl(var(--muted-foreground) / 0.03)" }}>
                  <p className="text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3">
                    You unlock right now
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {activeUnlocks.map((item, i) => {
                      const UnlockIcon = item.icon ? getIcon(item.icon) : null;
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center mt-[3px]"
                            style={{ background: "hsl(var(--color-green))" }}
                          >
                            {UnlockIcon ? (
                              <UnlockIcon size={8} className="text-white" />
                            ) : (
                              <IconCheck size={8} className="text-white" stroke={3} />
                            )}
                          </span>
                          <span className="text-[11px] text-foreground/80 font-medium leading-snug">
                            {item.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CTA */}
              <Button
                className="w-full text-[14px] font-extrabold mb-2.5"
                variant={ctaVariantMap[activeSummary.cta.variant] ?? "default"}
                size="lg"
                data-testid="button-enrollment-cta"
                asChild
              >
                <a href={activeSummary.cta.url} onClick={nav} onMouseDown={nav.onMouseDown}>
                  {activeSummary.cta.text}
                  <IconChevronRight size={16} stroke={2.5} />
                </a>
              </Button>

              {/* TRUST NOTE */}
              {activeSummary.trust_note && (
                <div className="border border-border rounded-[0.8rem] p-3 flex items-start gap-2.5 mt-2">
                  {activeSummary.trust_note.image_id ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                      <UniversalImage
                        id={activeSummary.trust_note.image_id}
                        alt={activeSummary.trust_note.initials}
                        className="w-full h-full"
                        sizes="32px"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-extrabold shrink-0">
                      {activeSummary.trust_note.initials}
                    </div>
                  )}
                  <p
                    className="text-[11px] text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activeSummary.trust_note.message }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: filtered program header ───────────────────────────────────

function ProgramFilteredHeader({ program }: { program: EnrollmentSelectorProgram }) {
  const ProgramIcon = program.selection_card.icon
    ? getIcon(program.selection_card.icon)
    : null;
  return (
    <div className="flex items-start gap-3.5">
      {ProgramIcon && (
        <span className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
          <ProgramIcon size={20} className="text-primary" />
        </span>
      )}
      <div>
        <h2 className="text-[18px] font-extrabold text-foreground leading-tight mb-1">
          {program.selection_card.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span>{program.selection_card.duration}</span>
          {program.selection_card.badge && (
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide"
              style={{
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
            >
              {program.selection_card.badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
