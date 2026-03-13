import _Marquee from "react-fast-marquee";

type MarqueeModule = Record<string, unknown>;

const imported = _Marquee as unknown as MarqueeModule;
const nested = imported["default"] as MarqueeModule | undefined;

const Marquee =
  typeof nested === "object" &&
  nested !== null &&
  "$$typeof" in nested
    ? (nested as typeof _Marquee)
    : _Marquee;

export default Marquee;
