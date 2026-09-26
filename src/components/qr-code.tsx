"use client";

import { useEffect, useState } from "react";

export function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    import("qrcode").then((qr) => {
      qr.toDataURL(value, {
        margin: 1,
        width: 280,
        color: { dark: "#1c1612", light: "#fffaf3" },
      }).then((url) => {
        if (!cancel) setSrc(url);
      });
    });
    return () => {
      cancel = true;
    };
  }, [value]);

  if (!src) return <div className="size-56 animate-pulse rounded-md bg-muted" />;
  return (
    // Data URLs from the QR library are not a remote image Next should optimize.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR code for this payment intent" className="size-56 rounded-md" />
  );
}
