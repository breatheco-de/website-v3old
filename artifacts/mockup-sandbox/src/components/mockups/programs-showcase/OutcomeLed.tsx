import { ArrowRight, Code2, Brain, BarChart3, Shield, TrendingUp } from "lucide-react";

const PRIMARY = "#0084FF";
const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";

const programs = [
  {
    icon: Code2,
    role: "Full Stack Developer",
    program: "Full Stack Development with AI",
    tagline: "Build products end-to-end. From pixel-perfect frontends to robust APIs — all supercharged with AI.",
    duration: "16 weeks",
    demand: "High demand",
    salaryRange: "$75k – $130k",
  },
  {
    icon: Brain,
    role: "AI Engineer",
    program: "AI Engineering",
    tagline: "Design, train, and ship AI systems that solve real business problems at scale.",
    duration: "20 weeks",
    demand: "Very high demand",
    salaryRange: "$90k – $160k",
  },
  {
    icon: BarChart3,
    role: "Data Scientist",
    program: "Data Science & ML",
    tagline: "Turn raw data into insight. Build ML models and tell stories that drive decisions.",
    duration: "18 weeks",
    demand: "High demand",
    salaryRange: "$80k – $140k",
  },
  {
    icon: Shield,
    role: "Security Analyst",
    program: "Cybersecurity",
    tagline: "Protect systems, detect threats, and secure the infrastructure companies depend on.",
    duration: "14 weeks",
    demand: "Critical demand",
    salaryRange: "$70k – $120k",
  },
];

function OutcomeCard({ program }: { program: typeof programs[0] }) {
  const Icon = program.icon;
  return (
    <div
      className="flex flex-col group"
      style={{
        backgroundColor: CARD_BG,
        borderRadius: "0.75rem",
        border: `1px solid ${BORDER}`,
        overflow: "hidden",
      }}
    >
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3">
          <Icon
            className="w-7 h-7 shrink-0"
            style={{ color: PRIMARY }}
            strokeWidth={1.5}
          />
          <div
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{
              color: PRIMARY,
              backgroundColor: "rgba(0, 132, 255, 0.08)",
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
            Become a
          </div>
          <h3
            className="text-xl font-bold leading-snug mb-2"
            style={{
              fontFamily: "'Lato', sans-serif",
              color: FOREGROUND,
              letterSpacing: "-0.01em",
            }}
          >
            {program.role}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.tagline}
          </p>
        </div>

        <div
          className="pt-4 flex items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          <div>
            <div
              className="text-xs"
              style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
            >
              Avg. salary
            </div>
            <div
              className="text-sm font-bold"
              style={{ color: FOREGROUND, fontFamily: "'Lato', sans-serif" }}
            >
              {program.salaryRange}
            </div>
          </div>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5"
            style={{ color: PRIMARY, fontFamily: "'Archivo', sans-serif" }}
          >
            {program.duration}
            <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutcomeLed() {
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
            Who do you want to become?
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: MUTED, fontFamily: "'Archivo', sans-serif", lineHeight: 1.6 }}
          >
            Each program is built around a specific career destination — not a course catalog.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {programs.map((program) => (
            <OutcomeCard key={program.role} program={program} />
          ))}
        </div>
      </div>
    </div>
  );
}
