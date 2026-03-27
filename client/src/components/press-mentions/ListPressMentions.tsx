import type { ListPressMentionsSection } from "@shared/schema";
import { ListPressMentionsCards } from "./ListPressMentionsCards";
import { ListPressMentionsFeaturedShowcase } from "./ListPressMentionsFeaturedShowcase";

interface ListPressMentionsProps {
  data: ListPressMentionsSection;
}

export function ListPressMentions({ data }: ListPressMentionsProps) {
  switch (data.variant) {
    case "featured_showcase":
      return <ListPressMentionsFeaturedShowcase data={data} />;
    case "cards":
    default:
      return <ListPressMentionsCards data={data} />;
  }
}

export default ListPressMentions;
