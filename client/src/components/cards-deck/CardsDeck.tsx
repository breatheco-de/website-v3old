import { CardsDeckDefault } from "./CardsDeckDefault";
import type { CardsDeckDefaultProps } from "./CardsDeckDefault";

export type CardsDeckProps = CardsDeckDefaultProps;

export function CardsDeck({ data }: CardsDeckProps) {
  const variant = data.variant || "default";

  switch (variant) {
    case "default":
    default:
      return <CardsDeckDefault data={data} />;
  }
}

export { CardsDeckDefault };
