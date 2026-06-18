import type { SyllabusLanding } from "@shared/schema";
import { SyllabusLandingContent } from "./SyllabusProgramModules";

export default function SyllabusLandingSyllabus({ data }: { data: SyllabusLanding }) {
  return <SyllabusLandingContent data={data} />;
}
