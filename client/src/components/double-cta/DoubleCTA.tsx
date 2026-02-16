import type { DoubleCTASection } from "@shared/schema";
import { DoubleCTAExpandable } from "./DoubleCTAExpandable";

interface DoubleCTAProps {
  data: DoubleCTASection;
}

export function DoubleCTA({ data }: DoubleCTAProps) {
  switch (data.variant) {
    case "expandable":
    default:
      return <DoubleCTAExpandable data={data} />;
  }
}

export default DoubleCTA;
