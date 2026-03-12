import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const programs = [
  {
    icon: Code2,
    name: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    accent: "#0084FF",
    accentLight: "rgba(0,132,255,0.08)",
    ctaText: "Explore Program",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    accent: "#7C3AED",
    accentLight: "rgba(124,58,237,0.08)",
    ctaText: "Explore Program",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    accent: "#059669",
    accentLight: "rgba(5,150,105,0.08)",
    ctaText: "Explore Program",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    accent: "#D97706",
    accentLight: "rgba(217,119,6,0.08)",
    ctaText: "Explore Program",
  },
];

function ProgramCard({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="relative bg-white rounded-xl border border-gray-100 flex flex-col overflow-hidden group transition-all duration-200"
      style={{ boxShadow: "0 2px 8px -2px rgba(0,0,0,0.08)" }}
    >
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: program.accent }}
      />
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: program.accentLight }}
        >
          <Icon
            className="w-6 h-6"
            style={{ color: program.accent }}
            strokeWidth={1.75}
          />
        </div>

        <div className="flex-1">
          <h3
            className="text-lg font-bold leading-snug mb-2"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: "#00041A",
              letterSpacing: "-0.01em",
            }}
          >
            {program.name}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "#737373", fontFamily: "'Archivo', sans-serif" }}
          >
            {program.tagline}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#737373" }}>
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5"
            style={{ color: program.accent, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.ctaText}
            <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Grid() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h2
            className="text-4xl font-bold mb-3"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: "#00041A",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Choose Your Career Path
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: "#737373", fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
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
