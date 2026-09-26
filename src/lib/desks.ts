import published from "@/lib/sui/merchants.json";
import type { Desk } from "@/lib/sui/types";

const addresses = published as Record<string, string>;

export const SYNTHETIC: Record<string, string> = {
  harbor: `0x${"11".repeat(32)}`,
  kanda: `0x${"22".repeat(32)}`,
  night: `0x${"33".repeat(32)}`,
};

const catalog: Omit<Desk, "address">[] = [
  {
    id: "harbor",
    name: "Harbor Bindery",
    city: "Tokyo",
    service: "Binds a short-run booklet and posts a delivery reference.",
    ask: "2800",
    verified: true,
  },
  {
    id: "kanda",
    name: "Kanda Desk",
    city: "Tokyo",
    service: "Prepares the filing and confirms delivery in writing.",
    ask: "3000",
    verified: true,
  },
  {
    id: "night",
    name: "Night Window",
    city: "Tokyo",
    service: "Offers the same job, and is not on the verification registry.",
    ask: "2500",
    verified: false,
  },
];

export function directory(local: boolean): Desk[] {
  return catalog.map((desk) => ({
    ...desk,
    address: addresses[desk.id] || (local ? SYNTHETIC[desk.id] : ""),
  }));
}

export function deskById(id: string, local: boolean) {
  return directory(local).find((desk) => desk.id === id) ?? null;
}
