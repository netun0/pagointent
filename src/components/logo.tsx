import { cn } from "cn";

type LogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

export function Logo({ size = 40, className, alt = "" }: LogoProps) {
  return (
    <img
      src="/pagointent-mark.jpg"
      alt={alt}
      width={size}
      height={size}
      className={cn(
        "inline-block shrink-0 rounded-[22%] bg-[#10182a] object-cover shadow-[0_0_28px_rgba(61,255,200,0.45)] ring-1 ring-[#3dffc8]/55",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
