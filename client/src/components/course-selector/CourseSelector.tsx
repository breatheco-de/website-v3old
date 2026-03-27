import type { CourseSelectorSection } from "@shared/schema";
import { CourseSelectorDefault } from "./CourseSelectorDefault";
import { CourseSelectorSolid } from "./CourseSelectorSolid";
import { CourseSelectorSpotlight } from "./CourseSelectorSpotlight";

interface CourseSelectorProps {
  data: CourseSelectorSection;
}

export function CourseSelector({ data }: CourseSelectorProps) {
  const variant = data.variant || "default";

  switch (variant) {
    case "solid":
      return <CourseSelectorSolid data={data} />;
    case "spotlight":
      return <CourseSelectorSpotlight data={data} />;
    case "default":
    default:
      return <CourseSelectorDefault data={data} />;
  }
}

export { CourseSelectorDefault, CourseSelectorSolid, CourseSelectorSpotlight };
export type { CourseSelectorProps };
