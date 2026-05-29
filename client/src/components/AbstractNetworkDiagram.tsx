import { useState, useEffect, useRef } from "react";

interface AbstractNetworkDiagramProps {
  className?: string;
}

type NodeId = "core" | "models" | "data" | "infrastructure" | "applications";

const captions: Record<NodeId, string> = {
  core: "AI Engineering orchestrates models, data, infrastructure, and applications into unified systems.",
  models: "Train, fine-tune, and deploy machine learning models for production use.",
  data: "Build pipelines that transform raw data into AI-ready embeddings and vectors.",
  infrastructure: "Scale and deploy AI systems reliably across cloud environments.",
  applications: "Create intelligent products and autonomous agents that solve real problems.",
};

const nodePositions = [
  { id: "models" as NodeId, angle: -60, radius: 38 },
  { id: "data" as NodeId, angle: 30, radius: 40 },
  { id: "infrastructure" as NodeId, angle: 150, radius: 38 },
  { id: "applications" as NodeId, angle: 240, radius: 40 },
];

export function AbstractNetworkDiagram({ className = "" }: AbstractNetworkDiagramProps) {
  const [activeNode, setActiveNode] = useState<NodeId>("core");
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; speed: number; angle: number }[]>([]);
  const animationRef = useRef<number>();
  
  const prefersReducedMotion = typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const initialParticles = Array.from({ length: 20 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.02 + 0.01,
      angle: Math.random() * Math.PI * 2,
    }));
    setParticles(initialParticles);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    
    const animate = () => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: (p.x + Math.cos(p.angle) * p.speed + 100) % 100,
        y: (p.y + Math.sin(p.angle) * p.speed + 100) % 100,
      })));
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [prefersReducedMotion]);

  const getNodePosition = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      cx: 50 + Math.cos(rad) * radius,
      cy: 50 + Math.sin(rad) * radius,
    };
  };

  const getCurvedPath = (angle: number, radius: number) => {
    const pos = getNodePosition(angle, radius);
    const midRadius = radius * 0.5;
    const midAngle = angle + 15;
    const mid = getNodePosition(midAngle, midRadius);
    return `M 50 50 Q ${mid.cx} ${mid.cy} ${pos.cx} ${pos.cy}`;
  };

  return (
    <div className={`relative ${className}`} data-testid="abstract-network-diagram">
      <div className="relative w-full aspect-square max-w-[280px] mx-auto">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            </radialGradient>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Subtle grid pattern */}
          <g opacity="0.1">
            {Array.from({ length: 5 }).map((_, i) => (
              <circle
                key={`grid-${i}`}
                cx="50"
                cy="50"
                r={10 + i * 10}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.3"
                strokeDasharray="2 4"
              />
            ))}
          </g>

          {/* Floating particles */}
          {particles.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.size * 0.4}
              fill="hsl(var(--primary))"
              opacity={activeNode === "core" ? 0.3 : 0.15}
              className={!prefersReducedMotion ? "transition-opacity duration-500" : ""}
            />
          ))}

          {/* Curved paths to nodes */}
          {nodePositions.map((node) => {
            const isActive = activeNode === node.id;
            return (
              <path
                key={`path-${node.id}`}
                d={getCurvedPath(node.angle, node.radius)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={isActive ? "1.2" : "0.6"}
                strokeOpacity={isActive ? 0.8 : 0.25}
                strokeDasharray="4 3"
                className={!prefersReducedMotion ? "transition-all duration-300" : ""}
              />
            );
          })}

          {/* Central core */}
          <g
            onMouseEnter={() => setActiveNode("core")}
            className="cursor-pointer"
          >
            {/* Outer glow ring */}
            <circle
              cx="50"
              cy="50"
              r="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              opacity={activeNode === "core" ? 0.6 : 0.2}
              className={!prefersReducedMotion ? "transition-opacity duration-300" : ""}
            />
            {/* Core circle */}
            <circle
              cx="50"
              cy="50"
              r="10"
              fill="url(#coreGradient)"
              filter="url(#glow)"
              className={`${!prefersReducedMotion && activeNode === "core" ? "animate-pulse-slow" : ""}`}
            />
            {/* Inner highlight */}
            <circle
              cx="48"
              cy="48"
              r="4"
              fill="white"
              opacity="0.3"
            />
          </g>

          {/* Orbiting nodes */}
          {nodePositions.map((node) => {
            const pos = getNodePosition(node.angle, node.radius);
            const isActive = activeNode === node.id;
            
            return (
              <g
                key={node.id}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode("core")}
                className="cursor-pointer"
              >
                {/* Outer ring on hover */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={isActive ? 8 : 6}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  opacity={isActive ? 0.5 : 0}
                  className={!prefersReducedMotion ? "transition-all duration-300" : ""}
                />
                {/* Node dot */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={isActive ? 5 : 4}
                  fill="hsl(var(--primary))"
                  opacity={isActive ? 1 : 0.6}
                  filter={isActive ? "url(#glow)" : ""}
                  className={!prefersReducedMotion ? "transition-all duration-300" : ""}
                />
                {/* Inner highlight */}
                <circle
                  cx={pos.cx - 1}
                  cy={pos.cy - 1}
                  r="1.5"
                  fill="white"
                  opacity={isActive ? 0.5 : 0.3}
                  className={!prefersReducedMotion ? "transition-opacity duration-300" : ""}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Caption */}
      <div 
        className={`mt-4 text-center min-h-[3rem] ${!prefersReducedMotion ? "transition-opacity duration-300" : ""}`}
        data-testid="diagram-caption"
      >
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          {captions[activeNode]}
        </p>
      </div>
    </div>
  );
}
