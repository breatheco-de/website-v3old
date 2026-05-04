
interface TechMoleculeProps {
  className?: string;
}

export function TechMolecule({ className = "" }: TechMoleculeProps) {
  return (
    <div className={`relative w-full h-48 md:h-56 ${className}`} data-testid="tech-molecule-diagram">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-md h-full">
          
          {/* Central node - AI Brain */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse-slow">
              <Brain className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            </div>
          </div>

          {/* Node 1 - Code (top left) */}
          <div className="absolute left-[15%] top-[20%]">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted border border-border flex items-center justify-center molecule-node">
              <Code className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Node 2 - Database (top right) */}
          <div className="absolute right-[15%] top-[15%]">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted border border-border flex items-center justify-center molecule-node" style={{ animationDelay: "0.3s" }}>
              <Database className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Node 3 - Cloud (right) */}
          <div className="absolute right-[5%] top-[55%]">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted border border-border flex items-center justify-center molecule-node" style={{ animationDelay: "0.6s" }}>
              <Cloud className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Node 4 - Terminal (bottom right) */}
          <div className="absolute right-[25%] bottom-[10%]">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted border border-border flex items-center justify-center molecule-node" style={{ animationDelay: "0.9s" }}>
              <Terminal className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Node 5 - CPU (bottom left) */}
          <div className="absolute left-[20%] bottom-[15%]">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted border border-border flex items-center justify-center molecule-node" style={{ animationDelay: "1.2s" }}>
              <Cpu className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Connection lines using CSS */}
          {/* Line from center to top-left */}
          <div className="absolute left-[18%] top-[34%] w-[28%] h-px bg-gradient-to-r from-border to-primary/40 origin-right rotate-[25deg] molecule-line" />
          
          {/* Line from center to top-right */}
          <div className="absolute right-[22%] top-[25%] w-[28%] h-px bg-gradient-to-l from-border to-primary/40 origin-left -rotate-[30deg] molecule-line" style={{ animationDelay: "0.2s" }} />
          
          {/* Line from center to right */}
          <div className="absolute right-[12%] top-[52%] w-[32%] h-px bg-gradient-to-l from-border to-primary/40 origin-left rotate-[8deg] molecule-line" style={{ animationDelay: "0.4s" }} />
          
          {/* Line from center to bottom-right */}
          <div className="absolute right-[28%] bottom-[28%] w-[22%] h-px bg-gradient-to-l from-border to-primary/40 origin-left rotate-[35deg] molecule-line" style={{ animationDelay: "0.6s" }} />
          
          {/* Line from center to bottom-left */}
          <div className="absolute left-[28%] bottom-[30%] w-[22%] h-px bg-gradient-to-r from-border to-primary/40 origin-right -rotate-[25deg] molecule-line" style={{ animationDelay: "0.8s" }} />

          {/* Decorative small dots on lines */}
          <div className="absolute left-[32%] top-[32%] w-2 h-2 rounded-full bg-primary/60 molecule-dot" />
          <div className="absolute right-[32%] top-[30%] w-2 h-2 rounded-full bg-primary/60 molecule-dot" style={{ animationDelay: "0.3s" }} />
          <div className="absolute right-[25%] top-[50%] w-2 h-2 rounded-full bg-primary/60 molecule-dot" style={{ animationDelay: "0.6s" }} />
          <div className="absolute right-[38%] bottom-[35%] w-2 h-2 rounded-full bg-primary/60 molecule-dot" style={{ animationDelay: "0.9s" }} />
          <div className="absolute left-[35%] bottom-[38%] w-2 h-2 rounded-full bg-primary/60 molecule-dot" style={{ animationDelay: "1.2s" }} />

        </div>
      </div>
    </div>
  );
}
import { Brain, Cloud, Code, Cpu, Database, Terminal } from "lucide-react";
