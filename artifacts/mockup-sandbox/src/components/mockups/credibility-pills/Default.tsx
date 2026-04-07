import { useState, useEffect } from "react";

const BASE = "https://storage.googleapis.com/4geeks-academy-website/media/";

const PILLS = [
  {
    label: "University Partners",
    logos: [
      { url: "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Clark_University_seal.svg/960px-Clark_University_seal.svg.png", alt: "Clark University" },
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

function CredibilityPill({
  label,
  logos,
  sectionHovered,
}: {
  label: string;
  logos: { url: string; alt: string }[];
  sectionHovered: boolean;
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
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 10px",
        background: sectionHovered ? "#EFEFEF" : "#F9FAFB",
        border: `1px solid ${sectionHovered ? "#C9CDD4" : "#E5E7EB"}`,
        borderRadius: "9999px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background 200ms ease, border-color 200ms ease",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "50px",
          height: "36px",
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
              maxWidth: "70px",
              width: "auto",
              objectFit: "contain",
              filter: "grayscale(100%) opacity(0.85)",
              opacity: i === activeIdx ? 1 : 0,
              transition: "opacity 200ms ease",
            }}
          />
        ))}
      </div>

      <div
        style={{
          width: "1px",
          height: "20px",
          background: "#D1D5DB",
          flexShrink: 0,
          marginLeft: "4px",
        }}
      />

      <span
        style={{
          fontSize: "15px",
          fontWeight: 500,
          color: "#00041A",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function Default() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#F5F5F5" : "#FFFFFF",
        padding: "24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80px",
        cursor: "pointer",
        transition: "background 200ms ease",
      }}
    >
      <div
        style={{
          maxWidth: "1152px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {PILLS.map((pill) => (
          <CredibilityPill
            key={pill.label}
            label={pill.label}
            logos={pill.logos}
            sectionHovered={hovered}
          />
        ))}
      </div>
    </div>
  );
}
