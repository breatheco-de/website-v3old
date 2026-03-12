import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const PRIMARY = "#0084FF";       // --primary
const PRIMARY_LIGHT = "rgba(0,132,255,0.08)"; // --primary at 8% opacity
const ACCENT = "#FFB718";        // --accent
const ACCENT_LIGHT = "rgba(255,183,24,0.1)";  // --accent at 10% opacity
const FOREGROUND = "#00041A";    // --foreground
const MUTED = "#737373";         // --muted-foreground
const CARD_BG = "#FFFFFF";       // --card / --background
const PAGE_BG = "#FAFAFA";       // --muted
const BORDER = "#EBEBEB";        // --border

const programs = [
  {
    icon: Code2,
    name: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    accentColor: PRIMARY,
    accentBg: PRIMARY_LIGHT,
    featured: true,
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    accentColor: PRIMARY,
    accentBg: PRIMARY_LIGHT,
    featured: false,
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    accentColor: ACCENT,
    accentBg: ACCENT_LIGHT,
    featured: false,
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    accentColor: ACCENT,
    accentBg: ACCENT_LIGHT,
    featured: false,
  },
];

function FeaturedCard({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="relative flex flex-col overflow-hidden group h-full"
      style={{
        backgroundColor: FOREGROUND,
        borderRadius: "0.75rem",
        boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{ height: "5px", width: "100%", backgroundColor: program.accentColor }}
      />
      <div className="p-8 flex flex-col flex-1 gap-5">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,132,255,0.15)" }}
        >
          <Icon className="w-7 h-7" style={{ color: "#FFFFFF" }} strokeWidth={1.75} />
        </div>

        <div className="flex-1">
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: program.accentColor, fontFamily: "'Archivo', sans-serif" }}
          >
            Featured Program
          </div>
          <h3
            className="text-2xl font-bold leading-snug mb-3"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: "#FFFFFF",
              letterSpacing: "-0.01em",
            }}
          >
            {program.name}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Archivo', sans-serif" }}
          >
            {program.tagline}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md transition-all duration-150"
            style={{
              backgroundColor: program.accentColor,
              color: "#FFFFFF",
              fontFamily: "'Archivo', sans-serif",
            }}
          >
            Explore Program
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SmallCard({ program }: { program: typeof programs[0] }) {
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
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: program.accentBg }}
          >
            <Icon className="w-5 h-5" style={{ color: program.accentColor }} strokeWidth={1.75} />
          </div>
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
              className="text-xs leading-relaxed mt-1"
              style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
            >
              {program.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-1 text-sm font-semibold transition-all duration-150 group-hover:gap-2"
            style={{ color: program.accentColor, fontFamily: "'Archivo', sans-serif" }}
          >
            Explore
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeaturedGrid() {
  const featured = programs[0];
  const rest = programs.slice(1);

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
            Choose Your Career Path
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
          >
            Four programs built around the skills companies are actively hiring for right now.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5" style={{ gridTemplateRows: "auto" }}>
          <div className="row-span-3">
            <FeaturedCard program={featured} />
          </div>
          {rest.map((program) => (
            <SmallCard key={program.name} program={program} />
          ))}
        </div>
      </div>
    </div>
  );
}
