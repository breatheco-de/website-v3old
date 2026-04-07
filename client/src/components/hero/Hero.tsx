import type { HeroSection } from "@shared/schema";
import { HeroSingleColumn } from "./HeroSingleColumn";
import { HeroShowcase } from "./HeroShowcase";
import { HeroProductShowcase } from "./HeroProductShowcase";
import { HeroSimpleTwoColumn } from "./HeroSimpleTwoColumn";
import { HeroSimpleStacked } from "./HeroSimpleStacked";
import { HeroCourse } from "./HeroCourse";
import { HeroCredibility } from "./HeroCredibility";

interface HeroProps {
  data: HeroSection;
  landingLocations?: string[];
}

export function Hero({ data, landingLocations }: HeroProps) {
  switch (data.variant) {
    case "singleColumn":
      return <HeroSingleColumn data={data} />;
    case "showcase":
      return <HeroShowcase data={data} />;
    case "productShowcase":
    case "ApplyFormProductShowcase":
      return <HeroProductShowcase data={data} landingLocations={landingLocations} />;
    case "simpleTwoColumn":
      return <HeroSimpleTwoColumn data={data} />;
    case "simpleStacked":
      return <HeroSimpleStacked data={data} />;
    case "course":
      return <HeroCourse data={data} />;
    case "credibility":
      return <HeroCredibility data={data} />;
    default:
      return null;
  }
}

export { HeroSingleColumn, HeroShowcase, HeroProductShowcase, HeroSimpleTwoColumn, HeroSimpleStacked, HeroCourse, HeroCredibility };