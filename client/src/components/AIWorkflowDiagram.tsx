import { useState, useEffect, useRef } from "react";
import { Bot, Brain, Code, Code2, Cpu, Database, Github, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import Rigobot from "@/components/custom-icons/Rigobot.tsx"

interface TechNode {
  id: string;
  name: string;
  icon: "python" | "openai" | "rigobot" | "langchain" | "huggingface" | "github" | "react" | "nodejs" | "jupyter" | "vscode";
  tooltip: string;
  yOffset: number;
  hoverColor: string;
}

const topRowTechnologies: TechNode[] = [
  { id: "python", name: "Python", icon: "python", tooltip: "Core programming language for AI development", yOffset: 28, hoverColor: "#E34C26" },
  { id: "vscode", name: "VS Code", icon: "vscode", tooltip: "AI-enhanced code editor with Copilot", yOffset: 4, hoverColor: "#8B5CF6" },
  { id: "jupyter", name: "Jupyter", icon: "jupyter", tooltip: "Interactive notebooks for data exploration", yOffset: -16, hoverColor: "#F37626" },
  { id: "github", name: "GitHub", icon: "github", tooltip: "Version control & collaborative development", yOffset: 4, hoverColor: "#6e5494" },
  { id: "openai", name: "OpenAI", icon: "openai", tooltip: "Master prompt engineering & API integration", yOffset: 28, hoverColor: "#10A37F" },
];

const bottomRowTechnologies: TechNode[] = [
  { id: "langchain", name: "LangChain", icon: "langchain", tooltip: "Build powerful AI applications with chain-of-thought", yOffset: -28, hoverColor: "#1C3C3C" },
  { id: "huggingface", name: "Hugging Face", icon: "huggingface", tooltip: "Access thousands of pre-trained ML models", yOffset: -4, hoverColor: "#FFD21E" },
  { id: "react", name: "React", icon: "react", tooltip: "Build modern AI-powered user interfaces", yOffset: 16, hoverColor: "#61DAFB" },
  { id: "nodejs", name: "Node.js", icon: "nodejs", tooltip: "Backend runtime for AI application servers", yOffset: -4, hoverColor: "#68A063" },
  { id: "rigobot", name: "Rigobot", icon: "rigobot", tooltip: "Your personal AI mentor for 24/7 coding support", yOffset: -28, hoverColor: "#FF6B35" },
];

function TechIcon({ icon, className }: { icon: TechNode["icon"]; className?: string }) {
  const iconClass = cn("w-4 h-4 md:w-5 md:h-5", className);
  
  switch (icon) {
    case "python":
      return <Code className={iconClass} />;
    case "openai":
      return <Brain className={iconClass} />;
    case "rigobot":
      return <Rigobot className={iconClass} />;
    case "langchain":
      return <Code className={iconClass} />;
    case "huggingface":
      return <Bot className={iconClass} />;
    case "github":
      return <Github className={iconClass} />;
    case "react":
      return <Code className={iconClass} />;
    case "nodejs":
      return <Server className={iconClass} />;
    case "jupyter":
      return <Database className={iconClass} />;
    case "vscode":
      return <Code2 className={iconClass} />;
    default:
      return <Cpu className={iconClass} />;
  }
}

interface AIWorkflowDiagramProps {
  className?: string;
  centerLabel?: string;
}

function TechNodeComponent({ 
  tech, 
  index, 
  isVisible,
  hoveredNode,
  onHover,
  row
}: { 
  tech: TechNode; 
  index: number;
  isVisible: boolean;
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
  row: "top" | "bottom";
}) {
  const isHovered = hoveredNode === tech.id;
  const baseDelay = row === "top" ? 0 : 400;
  const delay = baseDelay + index * 60;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center cursor-pointer transition-all duration-300 flex-1",
        isVisible ? "opacity-100" : "opacity-0",
        isHovered ? "z-50" : "z-10"
      )}
      style={{ 
        transitionDelay: `${delay}ms`,
        transform: `translateY(${tech.yOffset}px)`,
      }}
      onMouseEnter={() => onHover(tech.id)}
      onMouseLeave={() => onHover(null)}
      data-testid={`node-${tech.id}`}
    >
      <div
        className={cn(
          "relative flex items-center justify-center border transition-all duration-300",
          "w-10 h-8 md:w-12 md:h-9 rounded-xl",
          isHovered
            ? "border-primary/40 scale-110"
            : "border-primary/20"
        )}
        style={{
          boxShadow: isHovered
            ? "0 0 16px hsl(var(--primary) / 0.15), 0 2px 8px rgba(0,0,0,0.05)"
            : "none",
        }}
      >
        <div className="absolute inset-0 bg-background rounded-xl" />
        <div className={cn(
          "absolute inset-0 rounded-xl transition-colors duration-300",
          isHovered ? "bg-primary/10" : "bg-transparent"
        )} />
        <div 
          className="relative z-10 transition-colors duration-300"
          style={{ color: isHovered ? tech.hoverColor : "hsl(var(--primary) / 0.5)" }}
        >
          <TechIcon icon={tech.icon} />
        </div>
      </div>
      <span
        className={cn(
          "mt-1 text-[7px] md:text-[8px] font-medium text-center transition-colors duration-300 whitespace-nowrap",
          isHovered ? "text-primary" : "text-muted-foreground/60"
        )}
      >
        {tech.name}
      </span>

      {isHovered && (
        <div
          className={cn(
            "absolute z-30 px-2.5 py-1.5 text-[10px] rounded-lg shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-150",
            "bg-background/95 backdrop-blur-sm border border-primary/10 text-foreground",
            row === "top" ? "top-full mt-2" : "bottom-full mb-2"
          )}
          style={{ maxWidth: "150px", whiteSpace: "normal", textAlign: "center" }}
          data-testid={`tooltip-${tech.id}`}
        >
          {tech.tooltip}
        </div>
      )}
    </div>
  );
}

export function AIWorkflowDiagram({ className, centerLabel = "AI Engineering" }: AIWorkflowDiagramProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [isCenterHovered, setIsCenterHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const centerY = 50;
  const centerBoxTop = 44;
  const centerBoxBottom = 56;

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full", className)} 
      data-testid="ai-workflow-diagram"
    >
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        {topRowTechnologies.map((tech, i) => {
          const nodeX = (i + 0.5) / topRowTechnologies.length * 100;
          const nodeY = 16 + tech.yOffset * 0.18;
          
          const edgeOffsetX = (nodeX - 50) * 0.22;
          const startX = 50 + edgeOffsetX;
          const startY = centerBoxTop;
          
          const controlX = (startX + nodeX) / 2;
          const controlY = (startY + nodeY) / 2 - 2;
          
          const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${nodeX} ${nodeY + 5}`;
          
          const lineId = `top-${i}`;
          const isLineHovered = hoveredLine === lineId;
          
          return (
            <g key={`top-line-${i}`}>
              <path 
                d={pathD}
                fill="none"
                stroke="#A0D0FF"
                strokeOpacity={isLineHovered ? "0.7" : "0.33"}
                strokeWidth={isLineHovered ? "1" : "0.7"}
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-300 cursor-pointer pointer-events-auto",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ transitionDelay: isVisible ? `${i * 60 + 100}ms` : "0ms" }}
                onMouseEnter={() => setHoveredLine(lineId)}
                onMouseLeave={() => setHoveredLine(null)}
              />
              <path 
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="4"
                strokeLinecap="round"
                className="cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHoveredLine(lineId)}
                onMouseLeave={() => setHoveredLine(null)}
              />
              {isVisible && (
                <circle r="0.5" fill="#60A5FA">
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    path={pathD}
                    calcMode="spline"
                    keyPoints="0;1;1"
                    keyTimes="0;0.33;1"
                    keySplines="0.4 0 0.6 1;0 0 1 1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.7;0.7;0;0"
                    keyTimes="0;0.05;0.28;0.33;1"
                    dur="4.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
        
        {bottomRowTechnologies.map((tech, i) => {
          const nodeX = (i + 0.5) / bottomRowTechnologies.length * 100;
          const baseY = 78;
          const nodeY = baseY + tech.yOffset * 0.18;
          
          const edgeOffsetX = (nodeX - 50) * 0.22;
          const startX = 50 + edgeOffsetX;
          const startY = centerBoxBottom;
          
          const controlX = (startX + nodeX) / 2;
          const controlY = (startY + nodeY) / 2 + 2;
          
          const pathD = `M ${startX} ${startY} Q ${controlX} ${controlY} ${nodeX} ${nodeY - 3}`;
          
          const lineId = `bottom-${i}`;
          const isLineHovered = hoveredLine === lineId;
          
          return (
            <g key={`bottom-line-${i}`}>
              <path 
                d={pathD}
                fill="none"
                stroke="#A0D0FF"
                strokeOpacity={isLineHovered ? "0.7" : "0.33"}
                strokeWidth={isLineHovered ? "1" : "0.7"}
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-300 cursor-pointer pointer-events-auto",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ transitionDelay: isVisible ? `${i * 60 + 500}ms` : "0ms" }}
                onMouseEnter={() => setHoveredLine(lineId)}
                onMouseLeave={() => setHoveredLine(null)}
              />
              <path 
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="4"
                strokeLinecap="round"
                className="cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHoveredLine(lineId)}
                onMouseLeave={() => setHoveredLine(null)}
              />
              {isVisible && (
                <circle r="0.5" fill="#60A5FA">
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    path={pathD}
                    calcMode="spline"
                    keyPoints="0;1;1"
                    keyTimes="0;0.33;1"
                    keySplines="0.4 0 0.6 1;0 0 1 1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.7;0.7;0;0"
                    keyTimes="0;0.05;0.28;0.33;1"
                    dur="4.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      <div className="relative flex flex-col items-stretch gap-1 py-5 md:py-6" style={{ zIndex: 2 }}>
        <div className="flex items-center justify-between w-full">
          {topRowTechnologies.map((tech, index) => (
            <TechNodeComponent
              key={tech.id}
              tech={tech}
              index={index}
              isVisible={isVisible}
              hoveredNode={hoveredNode}
              onHover={setHoveredNode}
              row="top"
            />
          ))}
        </div>

        <div className="flex items-center justify-center w-full py-3 md:py-4">
          <div 
            className={cn(
              "relative flex items-center justify-center gap-2 md:gap-2.5 px-5 md:px-6 py-2 md:py-2.5 transition-all duration-300 cursor-pointer",
              "border rounded-2xl",
              isCenterHovered 
                ? "border-primary/40" 
                : "border-primary/20",
              isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
            )}
            style={{ 
              transitionDelay: isVisible ? "200ms" : "0ms",
              boxShadow: isCenterHovered
                ? "0 0 20px hsl(var(--primary) / 0.15), 0 2px 8px rgba(0,0,0,0.05)"
                : "none",
            }}
            onMouseEnter={() => setIsCenterHovered(true)}
            onMouseLeave={() => setIsCenterHovered(false)}
            data-testid="center-node-ai-engineering"
          >
            <div className="absolute inset-0 bg-background rounded-2xl" />
            <div className={cn(
              "absolute inset-0 rounded-2xl transition-colors duration-300",
              isCenterHovered ? "bg-primary/10" : "bg-transparent"
            )} />
            <Cpu className={cn(
              "relative z-10 w-4 h-4 md:w-5 md:h-5 transition-colors duration-300",
              isCenterHovered ? "text-primary" : "text-primary/60"
            )} />
            <span 
              className={cn(
                "relative z-10 text-xs md:text-sm font-semibold transition-colors duration-300",
                isCenterHovered ? "text-primary" : "text-primary/80"
              )}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {centerLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between w-full">
          {bottomRowTechnologies.map((tech, index) => (
            <TechNodeComponent
              key={tech.id}
              tech={tech}
              index={index}
              isVisible={isVisible}
              hoveredNode={hoveredNode}
              onHover={setHoveredNode}
              row="bottom"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default AIWorkflowDiagram;
