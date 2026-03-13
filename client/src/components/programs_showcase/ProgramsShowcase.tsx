import type { ProgramsShowcaseSection } from "@shared/schema";
import { ProgramsShowcaseGrid } from "./ProgramsShowcaseGrid";
import { ProgramsShowcaseStackedList } from "./ProgramsShowcaseStackedList";
import { ProgramsShowcaseSpotlight } from "./ProgramsShowcaseSpotlight";

interface ProgramsShowcaseProps {
  data: ProgramsShowcaseSection;
}

export function ProgramsShowcase({ data }: ProgramsShowcaseProps) {
  const layout = data.layout ?? "grid";

  switch (layout) {
    case "stacked_list":
      return <ProgramsShowcaseStackedList data={data} />;
    case "spotlight_with_list":
      return <ProgramsShowcaseSpotlight data={data} />;
    case "grid":
    default:
      return <ProgramsShowcaseGrid data={data} />;
  }
}
