import { ArrowRight, Code2, Brain, BarChart3, Shield } from "lucide-react";

const PRIMARY = "#0084FF";
const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";
const PRIMARY_BG = "rgba(0, 132, 255, 0.06)";

const programs = [
  {
    icon: Code2,
    name: "Full Stack Dev with AI",
    duration: "16 weeks",
    focus: "Web + AI integration",
    outcome: "Full Stack Developer",
    level: "Beginner friendly",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    duration: "20 weeks",
    focus: "Model design & deployment",
    outcome: "AI Engineer",
    level: "Some coding helpful",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    duration: "18 weeks",
    focus: "Python, ML, visualization",
    outcome: "Data Scientist",
    level: "Math background helpful",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    duration: "14 weeks",
    focus: "Threat detection & defense",
    outcome: "Security Analyst",
    level: "No experience needed",
  },
];

const rows = [
  { label: "Duration", key: "duration" as const },
  { label: "Focus area", key: "focus" as const },
  { label: "Career outcome", key: "outcome" as const },
  { label: "Entry point", key: "level" as const },
];

export function ComparisonRail() {
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
            Compare Programs
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
          >
            See exactly how each program differs before you decide.
          </p>
        </div>

        <div
          style={{
            backgroundColor: CARD_BG,
            borderRadius: "0.75rem",
            border: `1px solid ${BORDER}`,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th
                  style={{
                    width: "160px",
                    padding: "20px 24px",
                    textAlign: "left",
                    fontFamily: "'Archivo', sans-serif",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                />
                {programs.map((program) => {
                  const Icon = program.icon;
                  return (
                    <th
                      key={program.name}
                      style={{
                        padding: "20px 20px",
                        textAlign: "left",
                        verticalAlign: "top",
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        <Icon
                          className="w-6 h-6"
                          style={{ color: PRIMARY }}
                          strokeWidth={1.5}
                        />
                        <span
                          style={{
                            fontFamily: "'Lato', sans-serif",
                            fontSize: "15px",
                            fontWeight: 700,
                            color: FOREGROUND,
                            letterSpacing: "-0.01em",
                            lineHeight: 1.2,
                          }}
                        >
                          {program.name}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={row.key}
                  style={{
                    borderBottom: rowIdx < rows.length - 1 ? `1px solid ${BORDER}` : "none",
                    backgroundColor: rowIdx % 2 === 0 ? CARD_BG : PAGE_BG,
                  }}
                >
                  <td
                    style={{
                      padding: "16px 24px",
                      fontFamily: "'Archivo', sans-serif",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.label}
                  </td>
                  {programs.map((program) => (
                    <td
                      key={program.name}
                      style={{
                        padding: "16px 20px",
                        fontFamily: "'Archivo', sans-serif",
                        fontSize: "14px",
                        color: FOREGROUND,
                        lineHeight: 1.4,
                      }}
                    >
                      {program[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ padding: "20px 24px" }} />
                {programs.map((program) => (
                  <td key={program.name} style={{ padding: "20px 20px" }}>
                    <button
                      className="flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: PRIMARY, fontFamily: "'Archivo', sans-serif" }}
                    >
                      Explore
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
