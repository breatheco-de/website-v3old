import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";

const programs = [
  {
    icon: Code2,
    name: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    color: "#0084FF",
    number: "01",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    color: "#737373",
    number: "02",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    color: "#FFB718",
    number: "03",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    color: "#C0311B",
    number: "04",
  },
];

function EditorialItem({ program, isLast }: { program: typeof programs[0]; isLast: boolean }) {
  const Icon = program.icon;
  return (
    <div
      className="group flex items-stretch"
      style={{
        borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
      }}
    >
      <div
        className="w-1 shrink-0 rounded-full my-7"
        style={{ backgroundColor: program.color }}
      />

      <div className="flex items-start gap-5 py-7 pl-6 flex-1">
        <div className="flex items-center gap-4 shrink-0">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: MUTED,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              minWidth: "32px",
            }}
          >
            {program.number}
          </span>

          <Icon
            className="w-7 h-7 shrink-0"
            style={{ color: program.color }}
            strokeWidth={1.5}
          />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3
                className="text-xl font-bold leading-snug"
                style={{
                  fontFamily: "'Lato', sans-serif",
                  color: FOREGROUND,
                  letterSpacing: "-0.01em",
                }}
              >
                {program.name}
              </h3>
              <p
                className="text-base leading-relaxed mt-1.5 max-w-lg"
                style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
              >
                {program.tagline}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0 pt-1">
              <div
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{
                  color: MUTED,
                  fontFamily: "'Archivo', sans-serif",
                  backgroundColor: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{program.duration}</span>
              </div>

              <button
                className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5"
                style={{ color: program.color, fontFamily: "'Archivo', sans-serif" }}
              >
                Explore
                <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditorialList() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="w-full max-w-3xl">
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
            Choose Your Career Path
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
          >
            Four programs built around the skills companies are actively hiring for right now.
          </p>
        </div>

        <div
          style={{
            backgroundColor: CARD_BG,
            borderRadius: "0.75rem",
            border: `1px solid ${BORDER}`,
            padding: "0 32px",
          }}
        >
          {programs.map((program, index) => (
            <EditorialItem
              key={program.name}
              program={program}
              isLast={index === programs.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
