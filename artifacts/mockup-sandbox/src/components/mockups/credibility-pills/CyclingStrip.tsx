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

export function CyclingStrip() {
  const [catIdx, setCatIdx] = useState(0);
  const [logoIdx, setLogoIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCatIdx((prevCat) => {
          const nextCat = (prevCat + 1) % CATEGORIES.length;
          setLogoIdx((prevLogo) => (prevLogo + 1) % CATEGORIES[nextCat].logos.length);
          return nextCat;
        });
        setVisible(true);
      }, 250);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const cat = CATEGORIES[catIdx];
  const logo = cat.logos[logoIdx];

  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "20px 24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderTop: "1px solid #F3F4F6",
        borderBottom: "1px solid #F3F4F6",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          opacity: visible ? 1 : 0,
          transition: "opacity 250ms ease",
        }}
      >
        {/* Eyebrow label */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          Trusted by
        </span>

        {/* Thin divider */}
        <div style={{ width: "1px", height: "20px", background: "#E5E7EB" }} />

        {/* Rotating logo */}
        <img
          src={logo.url}
          alt={logo.alt}
          style={{
            height: "32px",
            width: "auto",
            maxWidth: "100px",
            objectFit: "contain",
            filter: "grayscale(100%) opacity(0.65)",
          }}
        />

        {/* Thin divider */}
        <div style={{ width: "1px", height: "20px", background: "#E5E7EB" }} />

        {/* Category label */}
        <span
          style={{
            fontSize: "15px",
            fontWeight: 500,
            color: "#00041A",
            whiteSpace: "nowrap",
          }}
        >
          {cat.label}
        </span>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: "5px", marginLeft: "8px" }}>
          {CATEGORIES.map((_, i) => (
            <div
              key={i}
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: i === catIdx ? "#0084FF" : "#E5E7EB",
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
