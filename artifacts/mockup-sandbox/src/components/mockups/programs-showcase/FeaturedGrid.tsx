import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield } from "lucide-react";

const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const FEATURED_BG = "rgba(0, 132, 255, 0.05)";
const FEATURED_BORDER = "rgba(0, 132, 255, 0.20)";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";

const programs = [
  {
    icon: Code2,
    name: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    color: "#0084FF",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    color: "#737373",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    color: "#FFB718",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    color: "#C0311B",
  },
];

function FeaturedCard({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="relative flex flex-col overflow-hidden group h-full"
      style={{
        backgroundColor: FEATURED_BG,
        borderRadius: "0.75rem",
        border: `1px solid ${FEATURED_BORDER}`,
      }}
    >
      <div
        style={{ height: "3px", width: "100%", backgroundColor: program.color }}
      />
      <div className="p-8 flex flex-col flex-1 gap-5">
        <Icon
          className="w-8 h-8"
          style={{ color: program.color }}
          strokeWidth={1.5}
        />

        <div className="flex-1">
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            Featured Program
          </div>
          <h3
            className="text-2xl font-bold leading-snug mb-3"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: FOREGROUND,
              letterSpacing: "-0.01em",
            }}
          >
            {program.name}
          </h3>
          <p
            className="text-base leading-relaxed"
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
            className="flex items-center gap-1.5 text-xs"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md transition-all duration-150"
            style={{
              backgroundColor: program.color,
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
      }}
    >
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="flex items-start gap-3">
          <Icon
            className="w-6 h-6 shrink-0 mt-0.5"
            style={{ color: program.color }}
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
              className="text-sm leading-relaxed mt-1"
              style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
            >
              {program.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{program.duration}</span>
          </div>
          <button
            className="flex items-center gap-1 text-sm font-semibold transition-all duration-150 group-hover:gap-2"
            style={{ color: program.color, fontFamily: "'Archivo', sans-serif" }}
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
