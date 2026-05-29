import { useEffect, useRef } from "react";

interface WorkflowAnimationProps {
  className?: string;
}

interface Node {
  x: number;
  y: number;
  label: string;
  icon: string;
  size: number;
}

interface Particle {
  x: number;
  y: number;
  pathIndex: number;
  progress: number;
  speed: number;
  size: number;
  opacity: number;
}

const techIcons = {
  rigobot: "🤖",
  openai: "◆",
  python: "⬡",
  react: "◎",
  nodejs: "⬢",
  git: "◇",
  github: "○",
};

export function WorkflowAnimation({ className = "" }: WorkflowAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);

  const prefersReducedMotion = typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Define workflow nodes
  const nodes: Node[] = [
    { x: 0.08, y: 0.5, label: "Rigobot", icon: "R", size: 28 },
    { x: 0.25, y: 0.25, label: "OpenAI", icon: "◆", size: 20 },
    { x: 0.25, y: 0.75, label: "Python", icon: "Py", size: 20 },
    { x: 0.5, y: 0.35, label: "React", icon: "⚛", size: 20 },
    { x: 0.5, y: 0.65, label: "Node", icon: "◈", size: 20 },
    { x: 0.75, y: 0.25, label: "Git", icon: "◇", size: 20 },
    { x: 0.75, y: 0.75, label: "GitHub", icon: "◉", size: 20 },
    { x: 0.92, y: 0.5, label: "Output", icon: "→", size: 24 },
  ];

  // Define paths between nodes (from index to index)
  const paths = [
    [0, 1], [0, 2],
    [1, 3], [2, 4],
    [3, 5], [4, 6],
    [3, 4],
    [5, 7], [6, 7],
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    particlesRef.current = paths.flatMap((_, pathIndex) => 
      Array.from({ length: 3 }, () => ({
        x: 0,
        y: 0,
        pathIndex,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
        size: 2 + Math.random() * 2,
        opacity: 0.4 + Math.random() * 0.4,
      }))
    );

    const animate = () => {
      if (!canvas || !ctx) return;

      const width = canvas.getBoundingClientRect().width;
      const height = canvas.getBoundingClientRect().height;

      // Clear with transparent background
      ctx.clearRect(0, 0, width, height);

      timeRef.current += 0.016;

      // Draw connection lines
      ctx.strokeStyle = "rgba(120, 120, 120, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      
      paths.forEach(([fromIdx, toIdx]) => {
        const from = nodes[fromIdx];
        const to = nodes[toIdx];
        
        ctx.beginPath();
        ctx.moveTo(from.x * width, from.y * height);
        
        // Curved path
        const midX = (from.x + to.x) / 2 * width;
        const midY = (from.y + to.y) / 2 * height;
        const controlX = midX + (Math.random() - 0.5) * 10;
        const controlY = midY;
        
        ctx.quadraticCurveTo(controlX, controlY, to.x * width, to.y * height);
        ctx.stroke();
      });

      ctx.setLineDash([]);

      // Update and draw particles
      if (!prefersReducedMotion) {
        particlesRef.current.forEach(particle => {
          particle.progress += particle.speed;
          if (particle.progress > 1) {
            particle.progress = 0;
            particle.opacity = 0.4 + Math.random() * 0.4;
          }

          const path = paths[particle.pathIndex];
          const from = nodes[path[0]];
          const to = nodes[path[1]];

          // Interpolate position
          const t = particle.progress;
          particle.x = (from.x + (to.x - from.x) * t) * width;
          particle.y = (from.y + (to.y - from.y) * t) * height;

          // Draw particle
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100, 100, 100, ${particle.opacity * (0.5 + 0.5 * Math.sin(particle.progress * Math.PI))})`;
          ctx.fill();
        });
      }

      // Draw nodes
      nodes.forEach((node, index) => {
        const x = node.x * width;
        const y = node.y * height;
        const size = node.size;

        // Node background circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        
        if (index === 0) {
          // Rigobot - slightly darker
          ctx.fillStyle = "rgba(60, 60, 60, 0.9)";
        } else if (index === nodes.length - 1) {
          // Output node
          ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
        } else {
          // Regular nodes
          ctx.fillStyle = "rgba(100, 100, 100, 0.7)";
        }
        ctx.fill();

        // Node border
        ctx.strokeStyle = "rgba(150, 150, 150, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Subtle pulse effect on hover area
        if (!prefersReducedMotion) {
          const pulse = Math.sin(timeRef.current * 2 + index) * 0.1 + 0.9;
          ctx.beginPath();
          ctx.arc(x, y, size * pulse * 1.2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(120, 120, 120, ${0.15 * (1 - pulse + 0.9)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // Node icon/text
        ctx.fillStyle = "rgba(220, 220, 220, 0.95)";
        ctx.font = `bold ${index === 0 ? 14 : 11}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.icon, x, y);

        // Node label below
        ctx.fillStyle = "rgba(140, 140, 140, 0.8)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillText(node.label, x, y + size + 10);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, paths, prefersReducedMotion]);

  return (
    <div className={`relative ${className}`} data-testid="workflow-animation">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ 
          width: "100%", 
          height: "100%",
          minHeight: "180px",
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <span 
          className="text-xs tracking-widest uppercase text-muted-foreground/60 font-medium"
          style={{ letterSpacing: "0.15em" }}
        >
          AI Engineering Workflow
        </span>
      </div>
    </div>
  );
}
