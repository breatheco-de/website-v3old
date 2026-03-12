import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const PRIMARY = "#0084FF";
const PRIMARY_LIGHT = "rgba(0,132,255,0.08)";
const ACCENT = "#FFB718";
const ACCENT_LIGHT = "rgba(255,183,24,0.1)";
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
    accentColor: PRIMARY,
    accentBg: PRIMARY_LIGHT,
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    accentColor: PRIMARY,
    accentBg: PRIMARY_LIGHT,
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    accentColor: ACCENT,
    accentBg: ACCENT_LIGHT,
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    accentColor: ACCENT,
    accentBg: ACCENT_LIGHT,
  },
];

function ProgramCard({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="relative flex flex-col overflow-hidden group transition-all duration-200"
      style={{
        backgroundColor: CARD_BG,
        borderRadius: "0.75rem",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 2px 8px -2px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{ height: "4px", width: "100%", backgroundColor: program.accentColor }}
      />

      <div className="p-6 flex flex-col flex-1 gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: program.accentBg }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: program.accentColor }}
            strokeWidth={1.75}
          />
        </div>

        <div className="flex-1">
          <h3
            className="text-lg font-bold leading-snug mb-2"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: FOREGROUND,
              letterSpacing: "-0.01em",
            }}
          >
            {program.name}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.tagline}
          </p>
        </div>

        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5"
            style={{ color: program.accentColor, fontFamily: "'Archivo', sans-serif" }}
          >
            Explore Program
            <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Grid() {
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

        <div className="grid grid-cols-2 gap-5">
          {programs.map((program) => (
            <ProgramCard key={program.name} program={program} />
          ))}
        </div>
      </div>
    </div>
  );
}
