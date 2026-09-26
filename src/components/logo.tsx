import Image from "next/image";
import { cn } from "cn";

type LogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export function Logo({ size = 36, className, priority = false, alt = "" }: LogoProps) {
  return (
    <Image
      src="/pagointent-mark.jpg"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "shrink-0 rounded-[22%] shadow-[0_0_24px_rgba(61,255,200,0.35)] ring-1 ring-[#3dffc8]/40",
        className,
      )}
    />
  );
}
