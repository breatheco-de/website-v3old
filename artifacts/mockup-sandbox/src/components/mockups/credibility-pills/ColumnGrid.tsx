import { useState, useEffect } from "react";

const BASE = "https://storage.googleapis.com/4geeks-academy-website/media/";

const CATEGORIES = [
  {
    label: "University Partners",
    logos: [
      { url: BASE + "clark-university_1769653206336.png", alt: "Clark University" },
      { url: BASE + "mdc_ce_1764720089793.png", alt: "Miami Dade College" },
      { url: BASE + "coimbra_1764725341501.png", alt: "Coimbra University" },
    ],
  },
  {
    label: "Government Programs",
    logos: [
      { url: BASE + "bid-logo.webp", alt: "IDB" },
      { url: BASE + "beacon_council_1764720100166.jpg", alt: "Beacon Council" },
      { url: BASE + "cinde_1770608132364.png", alt: "CINDE" },
    ],
  },
  {
    label: "Top Ranked, Every Year",
    logos: [
      { url: BASE + "forbes-logo.png", alt: "Forbes" },
      { url: BASE + "switchup_1765590146414.webp", alt: "SwitchUp" },
      { url: BASE + "course-report_1765590146414.webp", alt: "Course Report" },
    ],
  },
];

function CategoryColumn({
  label,
  logos,
}: {
  label: string;
  logos: { url: string; alt: string }[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % logos.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [logos.length]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "24px 16px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
      }}
    >
      {/* Logo slot — centered, visual weight at top */}
      <div
        style={{
          position: "relative",
          width: "120px",
          height: "40px",
          flexShrink: 0,
        }}
      >
        {logos.map((logo, i) => (
          <img
            key={logo.url}
            src={logo.url}
            alt={logo.alt}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              maxHeight: "40px",
              maxWidth: "120px",
              width: "auto",
              objectFit: "contain",
              filter: "grayscale(100%) opacity(0.6)",
              opacity: i === activeIdx ? 1 : 0,
              transition: "opacity 200ms ease",
            }}
          />
        ))}
      </div>

      {/* Thin divider */}
      <div
        style={{
          width: "32px",
          height: "1px",
          background: "#D1D5DB",
        }}
      />

      {/* Label below */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 1.3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function ColumnGrid() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          width: "100%",
          display: "flex",
          gap: "16px",
        }}
      >
        {CATEGORIES.map((cat) => (
          <CategoryColumn key={cat.label} label={cat.label} logos={cat.logos} />
        ))}
      </div>
    </div>
  );
}
