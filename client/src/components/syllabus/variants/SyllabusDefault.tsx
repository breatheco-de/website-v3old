import type { SyllabusDefault as SyllabusDefaultData } from "@shared/schema";
import { SyllabusDefaultAccordion } from "./SyllabusProgramModules";

export default function SyllabusDefault({ data }: { data: SyllabusDefaultData }) {
  return <SyllabusDefaultAccordion data={data} />;
}
