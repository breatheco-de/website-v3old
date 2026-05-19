import { memo, createElement } from "react";
import { Check } from "lucide-react";
import type {
  SplitCardsSection,
  SplitCardsBenefit,
  ToolIcon,
} from "@shared/schema";
import { UniversalImage } from "@/components/UniversalImage";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { getIcon, isCustomIcon } from "@/lib/icons";

interface SplitCardsProps {
  data: SplitCardsSection;
}

const sizeClasses: Record<string, string> = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-20 h-20",
};

const iconSizeMap: Record<string, number> = {
  sm: 20,
  md: 28,
  lg: 40,
};

/** Legacy short names used in tool_icons YAML before unified icon system. */
const TOOL_ICON_ALIASES: Record<string, string> = {
  BrandOpenai: "Sparkles",
  BrandFigma: "Figma",
  BrandGithub: "Github",
  BrandVscode: "Code2",
  Code: "Code",
  Robot: "bot",
  Sparkles: "Sparkles",
};

function resolveToolIcon(iconName?: string) {
  if (!iconName) return null;
  return getIcon(iconName) ?? (TOOL_ICON_ALIASES[iconName] ? getIcon(TOOL_ICON_ALIASES[iconName]) : null);
}

function ToolIconBadge({ tool, index }: { tool: ToolIcon; index: number }) {
  const size = tool.size || "md";
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizeMap[size];
  const IconComponent = resolveToolIcon(tool.icon);
  const isCustom = tool.icon ? isCustomIcon(tool.icon) : false;

  const positionStyle: React.CSSProperties = {};
  if (tool.position) {
    if (tool.position.top) positionStyle.top = tool.position.top;
    if (tool.position.bottom) positionStyle.bottom = tool.position.bottom;
    if (tool.position.left) positionStyle.left = tool.position.left;
    if (tool.position.right) positionStyle.right = tool.position.right;
  }

  const hasContent = tool.image_id || IconComponent;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={`absolute ${sizeClass} rounded-xl bg-card shadow-lg flex items-center justify-center`}
      style={positionStyle}
      data-testid={`tool-icon-${index}`}
    >
      {tool.image_id ? (
        <UniversalImage
          id={tool.image_id}
          className="w-3/4 h-3/4 object-contain"
          alt=""
        />
      ) : IconComponent ? (
        isCustom
          ? createElement(IconComponent, {
              width: String(iconSize),
              height: String(iconSize),
              className: "text-foreground",
            })
          : createElement(IconComponent, {
              size: iconSize,
              className: "text-foreground",
            })
      ) : null}
    </div>
  );
}

function BenefitRow({
  benefit,
  index,
  defaultIcon,
}: {
  benefit: SplitCardsBenefit;
  index: number;
  defaultIcon?: string;
}) {
  const iconName = benefit.icon || defaultIcon;
  const IconComponent = iconName ? (getIcon(iconName) ?? Check) : Check;
  const isCustom = iconName ? isCustomIcon(iconName) : false;

  return (
    <div
      className="flex items-start gap-3 py-3"
      data-testid={`benefit-item-${index}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isCustom ? (
          <IconComponent className="text-primary" width="20" height="20" />
        ) : (
          <IconComponent className="text-primary" size={20} strokeWidth={2.5} />
        )}
      </div>
      <p className="text-foreground font-medium leading-relaxed text-base">
        {benefit.text}
      </p>
    </div>
  );
}

export const SplitCards = memo(function SplitCards({ data }: SplitCardsProps) {
  const { primary, secondary, background, variant, primary_width } = data;

  const backgroundClass =
    background === "muted"
      ? "bg-muted"
      : background === "card"
        ? "bg-card"
        : "bg-background";

  const isPrimaryRight = variant === "primary-right";
  // Width ratios for lg breakpoint: narrow = 2fr/3fr, default = 3fr/1fr, wide = 4fr/1fr
  const getLgGridTemplate = () => {
    const width = primary_width || "default";
    if (width === "narrow") {
      return isPrimaryRight ? "1fr 2fr" : "2fr 1fr";
    } else if (width === "wide") {
      return isPrimaryRight ? "1fr 4fr" : "4fr 1fr";
    }
    return isPrimaryRight ? "1fr 3fr" : "3fr 1fr";
  };

  const PrimaryCard = (
    <div
      className="relative text-white rounded-[0.8rem] p-8 md:p-10 lg:p-12 overflow-hidden min-h-[320px] md:min-h-[360px]"
      style={{
        background: "linear-gradient(135deg, #366bff 0%, #4aa5ff 100%)",
      }}
      data-testid="card-primary"
    >
      <div className="relative z-10 max-w-2xl">
        {primary.badge && (
          <span
            className="inline-block text-sm font-medium text-white/80 mb-3"
            data-testid="text-primary-badge"
          >
            {primary.badge}
          </span>
        )}
        <h2
          className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight mb-4"
          data-testid="text-primary-heading"
        >
          {primary.heading}
        </h2>
        {primary.description && (
          <RichTextContent
            html={primary.description}
            className="text-white/85 leading-relaxed text-base md:text-lg [&_p]:mb-0 [&_a]:text-white [&_a]:underline"
            data-testid="text-primary-description"
          />
        )}
      </div>

      {primary.tool_icons && primary.tool_icons.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {primary.tool_icons.map((tool: ToolIcon, index: number) => (
            <ToolIconBadge key={index} tool={tool} index={index} />
          ))}
        </div>
      )}

      <div className="absolute bottom-4 left-8 opacity-20">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>
      </div>
    </div>
  );

  const hasImage = !!secondary.image_id;

  const SecondaryCard = hasImage ? (
    <div
      className="flex items-stretch relative rounded-[0.8rem] overflow-hidden h-full self-stretch"
      data-testid="card-secondary"
    >
        <UniversalImage
          id={secondary.image_id!}
          className="w-full h-full"
          style={{
            objectFit: secondary.image_object_fit || "cover",
            objectPosition:
              secondary.image_object_position || "center center",
          }}
          fieldContext={{ fieldPath: "secondary.image_id" }}
        />
    </div>
  ) : (
    <div
      className="text-accent-foreground rounded-[0.8rem] p-6 md:p-8 flex flex-col justify-center bg-[#0080ff0d]"
      data-testid="card-secondary"
    >
      <div className="space-y-1">
        {secondary.benefits?.map(
          (benefit: SplitCardsBenefit, index: number) => (
            <BenefitRow
              key={index}
              benefit={benefit}
              index={index}
              defaultIcon={secondary.bullet_icon}
            />
          ),
        )}
      </div>
    </div>
  );

  return (
    <section data-testid="section-split-cards">
      <div className="max-w-6xl mx-auto px-4">
        <style>{`
          @media (min-width: 1024px) {
            [data-split-cards-grid] {
              grid-template-columns: ${getLgGridTemplate()} !important;
            }
          }
        `}</style>
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          data-split-cards-grid
        >
          {isPrimaryRight ? (
            <>
              {SecondaryCard}
              {PrimaryCard}
            </>
          ) : (
            <>
              {PrimaryCard}
              {SecondaryCard}
            </>
          )}
        </div>
      </div>
    </section>
  );
});

export default SplitCards;
