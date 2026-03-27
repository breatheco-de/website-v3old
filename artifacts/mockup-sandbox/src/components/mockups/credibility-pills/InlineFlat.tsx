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

function InlinePair({
  label,
  logos,
  offset,
}: {
  label: string;
  logos: { url: string; alt: string }[];
  offset: number;
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
        gap: "8px",
      }}
    >
      {/* Logo slot */}
      <div
        style={{
          position: "relative",
          width: "64px",
          height: "28px",
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
              maxHeight: "28px",
              maxWidth: "64px",
              width: "auto",
              objectFit: "contain",
              filter: "grayscale(100%) opacity(0.55)",
              opacity: i === activeIdx ? 1 : 0,
              transition: "opacity 200ms ease",
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: "#6B7280",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function InlineFlat() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <div key={cat.label} style={{ display: "flex", alignItems: "center" }}>
            <InlinePair label={cat.label} logos={cat.logos} offset={i} />
            {i < CATEGORIES.length - 1 && (
              <div
                style={{
                  width: "1px",
                  height: "24px",
                  background: "#E5E7EB",
                  margin: "0 24px",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
