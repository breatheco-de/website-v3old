import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const PRIMARY = "#0084FF";
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
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
  },
];

function ProgramRow({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="flex items-center gap-5 group transition-all duration-200"
      style={{
        backgroundColor: CARD_BG,
        borderRadius: "0.75rem",
        border: `1px solid ${BORDER}`,
        padding: "20px 24px",
      }}
    >
      <div
        className="w-1 self-stretch shrink-0 rounded-full"
        style={{ backgroundColor: PRIMARY }}
      />

      <Icon
        className="w-7 h-7 shrink-0"
        style={{ color: PRIMARY }}
        strokeWidth={1.5}
      />

      <div className="flex-1 min-w-0">
        <h3
          className="text-base font-bold leading-snug"
          style={{
            fontFamily: "'Lato', sans-serif",
            color: FOREGROUND,
            letterSpacing: "-0.01em",
          }}
        >
          {program.name}
        </h3>
        <p
          className="text-sm leading-relaxed mt-0.5"
          style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
        >
          {program.tagline}
        </p>
      </div>

      <div
        className="flex items-center gap-1.5 text-xs font-medium shrink-0 px-3 py-1.5 rounded-full"
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
        className="flex items-center gap-1.5 text-sm font-semibold shrink-0 transition-all duration-150 group-hover:gap-2.5"
        style={{ color: PRIMARY, fontFamily: "'Archivo', sans-serif" }}
      >
        Explore
        <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

export function HorizontalRows() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="w-full max-w-4xl">
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

        <div className="flex flex-col gap-3">
          {programs.map((program) => (
            <ProgramRow key={program.name} program={program} />
          ))}
        </div>
      </div>
    </div>
  );
}
