import { ArrowRight, Code2, Brain, BarChart3, Shield } from "lucide-react";

const PRIMARY = "#0084FF";
const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";
const PRIMARY_BG = "rgba(0, 132, 255, 0.08)";
const PRIMARY_BORDER = "rgba(0, 132, 255, 0.2)";

const programs = [
  {
    icon: Code2,
    name: "Full Stack Dev with AI",
    duration: "16 weeks",
    x: 22,
    y: 28,
    description: "Broad skills, fast path to first job",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    duration: "20 weeks",
    x: 72,
    y: 68,
    description: "Deep specialization, highest demand",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    duration: "18 weeks",
    x: 60,
    y: 35,
    description: "Math + code, rich career landscape",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    duration: "14 weeks",
    x: 30,
    y: 62,
    description: "Focused skill set, critical infrastructure",
  },
];

export function SkillsMap() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <h2
            className="text-4xl font-bold mb-3"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: FOREGROUND,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Find Your Direction
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
          >
            Each program occupies a distinct space in the tech landscape. See where they sit.
          </p>
        </div>

        <div className="flex gap-8">
          <div
            className="relative flex-1"
            style={{
              backgroundColor: CARD_BG,
              borderRadius: "0.75rem",
              border: `1px solid ${BORDER}`,
              aspectRatio: "1 / 0.75",
              minHeight: "380px",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "12px",
                bottom: "12px",
                width: "1px",
                backgroundColor: BORDER,
                transform: "translateX(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "12px",
                right: "12px",
                height: "1px",
                backgroundColor: BORDER,
                transform: "translateY(-50%)",
              }}
            />

            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "'Archivo', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Specialized
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "'Archivo', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Generalist
            </div>
            <div
              style={{
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%) rotate(-90deg)",
                fontFamily: "'Archivo', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Fast Track
            </div>
            <div
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%) rotate(90deg)",
                fontFamily: "'Archivo', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Comprehensive
            </div>

            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <div
                  key={program.name}
                  className="group"
                  style={{
                    position: "absolute",
                    left: `${program.x}%`,
                    top: `${program.y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 10,
                    cursor: "default",
                  }}
                >
                  <div
                    className="flex flex-col items-center gap-1.5"
                    style={{ width: "120px" }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: PRIMARY_BG,
                        border: `1px solid ${PRIMARY_BORDER}`,
                      }}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: PRIMARY }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <span
                      className="text-center leading-snug"
                      style={{
                        fontFamily: "'Lato', sans-serif",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: FOREGROUND,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {program.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Archivo', sans-serif",
                        fontSize: "11px",
                        color: MUTED,
                      }}
                    >
                      {program.duration}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex flex-col gap-3"
            style={{ width: "220px", flexShrink: 0 }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
            >
              Programs
            </div>
            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <div
                  key={program.name}
                  className="flex flex-col gap-2 group"
                  style={{
                    padding: "14px 16px",
                    backgroundColor: CARD_BG,
                    borderRadius: "0.5rem",
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 shrink-0"
                      style={{ color: PRIMARY }}
                      strokeWidth={1.5}
                    />
                    <span
                      style={{
                        fontFamily: "'Lato', sans-serif",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: FOREGROUND,
                        lineHeight: 1.2,
                      }}
                    >
                      {program.name}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "'Archivo', sans-serif",
                      fontSize: "12px",
                      color: MUTED,
                      lineHeight: 1.4,
                    }}
                  >
                    {program.description}
                  </p>
                  <button
                    className="flex items-center gap-1 text-xs font-semibold self-start transition-all duration-150 group-hover:gap-1.5"
                    style={{ color: PRIMARY, fontFamily: "'Archivo', sans-serif" }}
                  >
                    Explore
                    <ArrowRight className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
