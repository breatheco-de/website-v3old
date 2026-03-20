import { useState } from "react";
import { ArrowRight, Clock, Code2, Brain, BarChart3, Shield, CheckCircle2, TrendingUp } from "lucide-react";

const PRIMARY = "#0084FF";
const PRIMARY_BG = "rgba(0, 132, 255, 0.05)";
const PRIMARY_BORDER = "rgba(0, 132, 255, 0.2)";
const FOREGROUND = "#00041A";
const MUTED = "#737373";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#FAFAFA";
const BORDER = "#EBEBEB";

interface ResolvedColor {
  base: string;
  opacity: number;
}

function resolveColorVar(color: string | undefined): ResolvedColor {
  const defaultColor: ResolvedColor = { base: PRIMARY, opacity: 1 };
  if (!color) return defaultColor;
  if (color.startsWith("#")) return { base: color, opacity: 1 };
  if (color.startsWith("rgb")) return { base: color, opacity: 1 };
  return defaultColor;
}

function hslColor(resolved: ResolvedColor, opacityMultiplier: number = 1): string {
  const finalOpacity = Math.min(resolved.opacity * opacityMultiplier, 1);
  const base = resolved.base;
  if (base.startsWith("#") || base.startsWith("rgb")) {
    if (opacityMultiplier < 1) {
      const hex = base.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
    }
    return base;
  }
  return `hsl(${base} / ${finalOpacity})`;
}

const programs = [
  {
    icon: Code2,
    name: "Full Stack Dev with AI",
    fullName: "Full Stack Development with AI",
    tagline: "Build modern web apps from frontend to backend, supercharged with AI tools.",
    duration: "16 weeks",
    demand: "High demand",
    color: "#0084FF",
    skills: [
      "HTML, CSS, JavaScript & TypeScript",
      "React and modern frontend frameworks",
      "Node.js, REST APIs, databases",
      "AI integration with LLMs & APIs",
      "Deployment and DevOps basics",
    ],
    outcome: "Full Stack Developer",
  },
  {
    icon: Brain,
    name: "AI Engineering",
    fullName: "AI Engineering",
    tagline: "Design, train and deploy AI models that solve real-world business problems.",
    duration: "20 weeks",
    demand: "Top salary",
    color: "#7C3AED",
    skills: [
      "Python for ML and AI",
      "Neural networks and deep learning",
      "LLM fine-tuning and prompt engineering",
      "Model deployment and MLOps",
      "AI product development",
    ],
    outcome: "AI Engineer",
  },
  {
    icon: BarChart3,
    name: "Data Science & ML",
    fullName: "Data Science & Machine Learning",
    tagline: "Turn raw data into actionable insight using Python, ML and visualization.",
    duration: "18 weeks",
    demand: "In demand",
    color: "#059669",
    skills: [
      "Python, Pandas, NumPy",
      "Data visualization and storytelling",
      "Machine learning fundamentals",
      "Statistical modeling",
      "SQL and data pipelines",
    ],
    outcome: "Data Scientist",
  },
  {
    icon: Shield,
    name: "Cybersecurity",
    fullName: "Cybersecurity",
    tagline: "Protect systems and networks against modern threats and vulnerabilities.",
    duration: "14 weeks",
    demand: null,
    color: "#DC2626",
    skills: [
      "Network security fundamentals",
      "Ethical hacking and penetration testing",
      "Incident response and forensics",
      "Cloud security",
      "Compliance and risk management",
    ],
    outcome: "Security Analyst",
  },
];

export function SpotlightSelector() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = programs[activeIndex];
  const ActiveIcon = active.icon;
  const resolved = resolveColorVar(active.color);

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

        <div
          className="flex gap-0"
          style={{
            backgroundColor: CARD_BG,
            borderRadius: "0.75rem",
            border: `1px solid ${BORDER}`,
            overflow: "hidden",
          }}
        >
          {/* Small cards — sidebar */}
          <div
            className="flex flex-col"
            style={{ width: "260px", borderRight: `1px solid ${BORDER}`, flexShrink: 0 }}
          >
            {programs.map((program, idx) => {
              const Icon = program.icon;
              const isActive = idx === activeIndex;
              const itemResolved = resolveColorVar(program.color);
              return (
                <button
                  key={program.name}
                  onClick={() => setActiveIndex(idx)}
                  className="flex items-start gap-3 text-left transition-all duration-150"
                  style={{
                    padding: "14px 16px",
                    backgroundColor: isActive ? PRIMARY_BG : "transparent",
                    borderLeft: isActive ? `2px solid ${PRIMARY}` : "2px solid transparent",
                    borderBottom: idx < programs.length - 1 ? `1px solid ${BORDER}` : "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: isActive ? PRIMARY : MUTED }}
                    strokeWidth={1.5}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        style={{
                          fontFamily: "'Lato', sans-serif",
                          fontSize: "13px",
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? FOREGROUND : MUTED,
                          lineHeight: 1.3,
                          display: "block",
                        }}
                      >
                        {program.name}
                      </span>
                      {program.demand && (
                        <div
                          className="flex items-center gap-0.5 rounded-full shrink-0 whitespace-nowrap"
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            color: hslColor(itemResolved),
                            backgroundColor: hslColor(itemResolved, 0.1),
                            fontFamily: "'Archivo', sans-serif",
                          }}
                        >
                          <TrendingUp className="w-2.5 h-2.5 shrink-0" strokeWidth={2} />
                          <span style={{ marginLeft: "2px" }}>{program.demand}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Featured card — detail panel with primary tint background */}
          <div
            className="flex-1 p-8 flex flex-col gap-6"
            style={{ backgroundColor: PRIMARY_BG }}
          >
            {/* Icon row with badge on the right */}
            <div className="flex items-center justify-between gap-3">
              <ActiveIcon
                className="w-8 h-8 shrink-0"
                style={{ color: PRIMARY }}
                strokeWidth={1.5}
              />
              {active.demand && (
                <div
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{
                    color: hslColor(resolved),
                    backgroundColor: hslColor(resolved, 0.1),
                    fontFamily: "'Archivo', sans-serif",
                  }}
                >
                  <TrendingUp className="w-3 h-3" strokeWidth={2} />
                  {active.demand}
                </div>
              )}
            </div>

            <div>
              <h3
                className="text-2xl font-bold leading-snug mb-1.5"
                style={{
                  fontFamily: "'Lato', sans-serif",
                  color: FOREGROUND,
                  letterSpacing: "-0.01em",
                }}
              >
                {active.fullName}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
              >
                {active.tagline}
              </p>
            </div>

            <div>
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
              >
                What you'll learn
              </div>
              <ul className="flex flex-col gap-2">
                {active.skills.map((skill) => (
                  <li
                    key={skill}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: FOREGROUND, fontFamily: "'Archivo', sans-serif" }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: PRIMARY }}
                      strokeWidth={1.5}
                    />
                    {skill}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="flex items-center justify-between pt-5 mt-auto"
              style={{ borderTop: `1px solid ${PRIMARY_BORDER}` }}
            >
              <div
                className="flex items-center gap-1.5 text-sm"
                style={{ color: MUTED, fontFamily: "'Archivo', sans-serif" }}
              >
                <Clock className="w-4 h-4" />
                <span>{active.duration}</span>
                <span style={{ color: BORDER }}>·</span>
                <span>Become a {active.outcome}</span>
              </div>
              <button
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-md"
                style={{
                  backgroundColor: PRIMARY,
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
      </div>
    </div>
  );
}
