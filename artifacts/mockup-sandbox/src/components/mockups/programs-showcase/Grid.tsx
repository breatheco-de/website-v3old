import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield, TrendingUp } from "lucide-react";

const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";

const programs = [
  {
    icon: Code2,
    label: "Become a",
    name: "Full Stack Developer",
    program: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    demand: "High demand",
    color: "#0084FF",
    colorRgb: "0, 132, 255",
  },
  {
    icon: Brain,
    label: "Become an",
    name: "AI Engineer",
    program: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    demand: "Very high demand",
    color: "#737373",
    colorRgb: "115, 115, 115",
  },
  {
    icon: BarChart3,
    label: "Become a",
    name: "Data Scientist",
    program: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    demand: "High demand",
    color: "#FFB718",
    colorRgb: "255, 183, 24",
  },
  {
    icon: Shield,
    label: "Become a",
    name: "Security Analyst",
    program: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    demand: "Critical demand",
    color: "#C0311B",
    colorRgb: "192, 49, 27",
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
      }}
    >
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3">
          <Icon
            className="w-7 h-7 shrink-0"
            style={{ color: program.color }}
            strokeWidth={1.5}
          />
          <div
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{
              color: program.color,
              backgroundColor: `rgba(${program.colorRgb}, 0.10)`,
              fontFamily: "'Archivo', sans-serif",
            }}
          >
            <TrendingUp className="w-3 h-3" />
            {program.demand}
          </div>
        </div>

        <div className="flex-1">
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.label}
          </div>
          <h3
            className="text-lg font-bold leading-snug mb-1"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: FOREGROUND,
              letterSpacing: "-0.01em",
            }}
          >
            {program.name}
          </h3>
          <div
            className="text-xs mb-2"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.program}
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.tagline}
          </p>
        </div>

        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: `1px solid ${program.color}` }}
        >
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5"
            style={{ color: program.color, fontFamily: "'Archivo', sans-serif" }}
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
