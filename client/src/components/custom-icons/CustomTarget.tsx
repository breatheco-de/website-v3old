interface TargetProps {
  width?: string;
  height?: string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function Target({
  width = "88px",
  height = "88px",
  color,
  style,
  className,
}: TargetProps) {
  // Note: This icon has multiple colors from Flaticon, color prop is accepted but not used
  return (
    <svg
      width={width}
      height={height}
      style={style}
      className={className}
      viewBox="0 0 497 497"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m463.342 134.13c-118.581-130.937-237.162 29.698-355.743-101.24 0 34.65-15.016 64.117-15.016 98.767 0 32.843 15.016 70.871 15.016 103.714 118.581 63.444 237.162-164.685 355.743-101.241z" fill="#fe75a7"/>
      <path d="m92.583 463.133c-8.293 0-15.016-6.723-15.016-15.015v-433.103c0-8.292 6.723-15.015 15.016-15.015s15.016 6.723 15.016 15.015v433.103c0 8.292-6.723 15.015-15.016 15.015z" fill="#cc8337"/>
      <path d="m132.287 244.557c88.789 19.305 177.577-102.157 266.366-119.613-88.788-19.305-177.577 102.157-266.366 119.613z" fill="#fe5995"/>
      <path d="m147.674 456.926 15.46 40.074h-86.18v-27.775c.137-7.829-3.053-15.348-8.779-20.69l-25.735-24.01c-5.602-5.227-8.783-12.544-8.783-20.206v-35.498c0-15.262 12.373-27.634 27.635-27.634h46.305l-.189-26.311h12.629c15.263 0 27.635 12.372 27.635 27.634v114.416z" fill="#fff1ab"/>
      <path d="m147.674 456.926v-114.415c0-15.262-12.373-27.634-27.635-27.634h-12.629l.184 25.635c.047.661.08 1.326.08 2v114.415l15.46 40.073h40z" fill="#ffea80"/>
      <path d="m76.954 497v-27.775h75.464l10.716 27.775z" fill="#6b46cf"/>
      <path d="m152.418 469.225h-40l10.716 27.775h40z" fill="#5f36cf"/>
    </svg>
  );
}
