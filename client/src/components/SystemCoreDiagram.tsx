import { useState, useEffect, useRef } from "react";
import { getTechBrandIcon } from "@/lib/tech-brand-icons";

interface SystemCoreDiagramProps {
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;
}

interface TechBox {
  iconKey: string;
  label: string;
}

const leftTechs: TechBox[] = [
  { iconKey: "openai", label: "OpenAI" },
  { iconKey: "python", label: "Python" },
  { iconKey: "react", label: "React" },
  { iconKey: "nodejs", label: "Node.js" },
];

const rightTechs: TechBox[] = [
  { iconKey: "git", label: "Git" },
  { iconKey: "github", label: "GitHub" },
];

export function SystemCoreDiagram({ className = "" }: SystemCoreDiagramProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [layerOffsets, setLayerOffsets] = useState([0, 0, 0, 0, 0]);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  
  const prefersReducedMotion = typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Initialize particles
  useEffect(() => {
    const initialParticles: Particle[] = Array.from({ length: 20 }, () => ({
      x: 25 + Math.random() * 50,
      y: 20 + Math.random() * 60,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.2,
      speed: Math.random() * 0.008 + 0.003,
      angle: Math.random() * Math.PI * 2,
    }));
    setParticles(initialParticles);
  }, []);

  // Animation loop for parallax and particles
  useEffect(() => {
    if (prefersReducedMotion) return;
    
    const animate = () => {
      timeRef.current += 0.016;
      
      // Update layer parallax offsets (very slow)
      setLayerOffsets([
        Math.sin(timeRef.current * 0.15) * 0.8,
        Math.sin(timeRef.current * 0.12 + 1) * 0.6,
        Math.sin(timeRef.current * 0.18 + 2) * 0.5,
        Math.sin(timeRef.current * 0.1 + 3) * 0.7,
        Math.sin(timeRef.current * 0.14 + 4) * 0.4,
      ]);
      
      // Update particles (slow drift)
      setParticles(prev => prev.map(p => {
        let newX = p.x + Math.cos(p.angle) * p.speed;
        let newY = p.y + Math.sin(p.angle) * p.speed;
        
        // Wrap around bounds
        if (newX < 20) newX = 80;
        if (newX > 80) newX = 20;
        if (newY < 15) newY = 85;
        if (newY > 85) newY = 15;
        
        return { ...p, x: newX, y: newY };
      }));
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [prefersReducedMotion]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  // Generate hexagon path
  const getHexagonPath = (cx: number, cy: number, size: number, offsetX: number = 0, offsetY: number = 0) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + offsetX + Math.cos(angle) * size;
      const y = cy + offsetY + Math.sin(angle) * size;
      points.push(`${x},${y}`);
    }
    return `M${points.join(" L")} Z`;
  };

  // Calculate distance from mouse for particle brightness
  const getParticleBrightness = (px: number, py: number) => {
    if (!isHovered) return 1;
    const dist = Math.sqrt(Math.pow(px - mousePos.x, 2) + Math.pow(py - mousePos.y, 2));
    return Math.max(0.5, Math.min(2, 1 + (30 - dist) / 30));
  };

  const layers = [
    { size: 28, opacity: isHovered ? 0.55 : 0.35, strokeWidth: 1.0 },
    { size: 23, opacity: isHovered ? 0.65 : 0.42, strokeWidth: 0.85 },
    { size: 18, opacity: isHovered ? 0.75 : 0.5, strokeWidth: 0.7 },
    { size: 13, opacity: isHovered ? 0.85 : 0.6, strokeWidth: 0.55 },
    { size: 8, opacity: isHovered ? 0.95 : 0.72, strokeWidth: 0.45 },
  ];

  // Connector line endpoints for left side (4 techs)
  const leftLineEndpoints = [
    { boxY: 12, coreX: 28, coreY: 35 },
    { boxY: 33, coreX: 28, coreY: 45 },
    { boxY: 54, coreX: 28, coreY: 55 },
    { boxY: 75, coreX: 28, coreY: 65 },
  ];

  // Connector line endpoints for right side (2 techs)
  const rightLineEndpoints = [
    { boxY: 33, coreX: 72, coreY: 45 },
    { boxY: 67, coreX: 72, coreY: 55 },
  ];

  return (
    <div 
      className={`relative ${className}`} 
      data-testid="system-core-diagram"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Full diagram layout with side boxes */}
      <div className="relative flex items-center justify-center gap-3">
        {/* Left tech boxes */}
        <div className="flex flex-col gap-2 z-10">
          {leftTechs.map((tech) => {
            const Icon = getTechBrandIcon(tech.iconKey);
            return (
            <div
              key={tech.label}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border/50 shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md hover:border-primary/30"
              data-testid={`tech-box-${tech.label.toLowerCase().replace(/\./g, '')}`}
            >
              {Icon ? (
                <Icon className="w-4 h-4 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
              ) : null}
              <span className="text-xs font-medium text-foreground whitespace-nowrap">{tech.label}</span>
            </div>
            );
          })}
        </div>

        {/* Center hexagon diagram with connector lines */}
        <div className={`relative w-[200px] h-[200px] flex-shrink-0 transition-transform duration-500 ${isHovered && !prefersReducedMotion ? "scale-105" : ""}`}>
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            style={{ overflow: "visible" }}
          >
            <defs>
              <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Left connector lines */}
            {leftLineEndpoints.map((line, i) => (
              <g key={`left-line-${i}`} opacity={isHovered ? 0.6 : 0.4}>
                <path
                  d={`M -8 ${line.boxY} L 8 ${line.boxY} L ${line.coreX} ${line.coreY}`}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={line.coreX}
                  cy={line.coreY}
                  r="1.5"
                  fill="hsl(var(--primary))"
                  opacity="0.7"
                />
              </g>
            ))}

            {/* Right connector lines */}
            {rightLineEndpoints.map((line, i) => (
              <g key={`right-line-${i}`} opacity={isHovered ? 0.6 : 0.4}>
                <path
                  d={`M 108 ${line.boxY} L 92 ${line.boxY} L ${line.coreX} ${line.coreY}`}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={line.coreX}
                  cy={line.coreY}
                  r="1.5"
                  fill="hsl(var(--primary))"
                  opacity="0.7"
                />
              </g>
            ))}

            {/* Subtle background grid lines */}
            <g opacity="0.05">
              {Array.from({ length: 5 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1="20"
                  y1={30 + i * 10}
                  x2="80"
                  y2={30 + i * 10}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.3"
                />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={30 + i * 10}
                  y1="20"
                  x2={30 + i * 10}
                  y2="80"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.3"
                />
              ))}
            </g>

            {/* Floating signal particles */}
            {particles.map((p, i) => {
              const brightness = getParticleBrightness(p.x, p.y);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={p.size}
                  fill="hsl(var(--primary))"
                  opacity={p.opacity * brightness * (isHovered ? 1.3 : 1)}
                  className={!prefersReducedMotion ? "transition-opacity duration-300" : ""}
                />
              );
            })}

            {/* Layered hexagon wireframes with parallax */}
            <g filter={isHovered ? "url(#coreGlow)" : ""}>
              {layers.map((layer, i) => (
                <path
                  key={i}
                  d={getHexagonPath(
                    50,
                    50,
                    layer.size,
                    prefersReducedMotion ? 0 : layerOffsets[i] * (i % 2 === 0 ? 1 : -1),
                    prefersReducedMotion ? 0 : layerOffsets[i] * 0.5 * (i % 2 === 0 ? -1 : 1)
                  )}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={layer.strokeWidth}
                  opacity={layer.opacity}
                  className={!prefersReducedMotion ? "transition-opacity duration-500" : ""}
                />
              ))}
            </g>

            {/* Inner geometric accent - offset rectangles */}
            <g opacity={isHovered ? 0.5 : 0.3}>
              <rect
                x={50 - 5 + (prefersReducedMotion ? 0 : layerOffsets[0] * 0.3)}
                y={50 - 3 + (prefersReducedMotion ? 0 : layerOffsets[1] * 0.2)}
                width="10"
                height="6"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.4"
                className={!prefersReducedMotion ? "transition-opacity duration-500" : ""}
              />
              <rect
                x={50 - 3 + (prefersReducedMotion ? 0 : layerOffsets[2] * -0.2)}
                y={50 - 2 + (prefersReducedMotion ? 0 : layerOffsets[3] * -0.15)}
                width="6"
                height="4"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.3"
                className={!prefersReducedMotion ? "transition-opacity duration-500" : ""}
              />
            </g>

            {/* Center dot */}
            <circle
              cx="50"
              cy="50"
              r="1.5"
              fill="hsl(var(--primary))"
              opacity={isHovered ? 0.9 : 0.6}
              className={!prefersReducedMotion ? "transition-opacity duration-300" : ""}
            />
          </svg>
        </div>

        {/* Right tech boxes */}
        <div className="flex flex-col gap-2 z-10">
          {rightTechs.map((tech) => {
            const Icon = getTechBrandIcon(tech.iconKey);
            return (
            <div
              key={tech.label}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border/50 shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md hover:border-primary/30"
              data-testid={`tech-box-${tech.label.toLowerCase()}`}
            >
              {Icon ? (
                <Icon className="w-4 h-4 text-muted-foreground transition-colors duration-300" />
              ) : null}
              <span className="text-xs font-medium text-foreground whitespace-nowrap">{tech.label}</span>
            </div>
            );
          })}
        </div>
      </div>

      {/* Label below */}
      <div className="mt-4 text-center">
        <span 
          className="text-xs tracking-widest uppercase text-muted-foreground/70 font-medium"
          style={{ letterSpacing: "0.15em" }}
        >
          AI Engineering
        </span>
      </div>
    </div>
  );
}
