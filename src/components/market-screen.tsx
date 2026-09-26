"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buyListing, getStatus, listItem, listListings } from "@/lib/actions";
import { decryptKey, readVault } from "@/lib/custody";
import { explorerUrl, formatUsd, shortAddress, usdToMicro } from "@/lib/sui/format";
import type { ChainStatus, ListingRecord } from "@/lib/sui/types";

export function MarketScreen() {
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [price, setPrice] = useState("4");
  const [tab, setTab] = useState<"flagship" | "community">("flagship");

  async function load() {
    setError(null);
    try {
      const [nextListings, nextStatus] = await Promise.all([listListings(), getStatus()]);
      setListings(nextListings.listings);
      setStatus(nextStatus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the market.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    Promise.all([listListings(), getStatus()])
      .then(([nextListings, nextStatus]) => {
        if (cancel) return;
        setListings(nextListings.listings);
        setStatus(nextStatus);
        setLoading(false);
      })
      .catch((reason: Error) => {
        if (cancel) return;
        setError(reason.message);
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function withKey() {
    const vault = readVault();
    if (!vault) throw new Error("Accept a payment first. The buyer has to be a wallet Intenses created.");
    return decryptKey(password, vault);
  }

  async function buy(listing: ListingRecord) {
    setBusyId(listing.id);
    setError(null);
    try {
      const secret = await withKey();
      const receipt = await buyListing(secret, listing.id, listing.price);
      setVoucher(`${listing.title} · ${receipt.voucher ?? "PAID"}`);
      toast.success(`Bought ${listing.title}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Purchase failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const micro = usdToMicro(price);
    if (!micro) {
      setError("Enter a price in dollars.");
      return;
    }
    setBusyId("list");
    setError(null);
    try {
      const secret = await withKey();
      await listItem(secret, title, detail, micro.toString());
      setTitle("");
      setDetail("");
      toast.success("Your item is on the market.");
      setTab("community");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not list the item.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = listings.filter((listing) => (tab === "flagship" ? listing.kind === 0 : listing.kind === 1));

  return (
    <div>
      <h1 className="font-serif text-4xl tracking-tight">Spend it, or sell something</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Flagship goods are seeded by the package. After you accept a payment you can buy one, and you can list your own.
        A purchase pays the seller’s Sui address in test USDC. The voucher is a demo stand-in for a partner filling the order.
      </p>
      <div className="mt-5 flex gap-2">
        {(["flagship", "community"] as const).map((item) => (
          <Button key={item} type="button" variant={tab === item ? "default" : "outline"} className="rounded-full" onClick={() => setTab(item)}>
            {item === "flagship" ? "Flagship" : "From payees"}
          </Button>
        ))}
      </div>
      <div className="mt-4 max-w-sm space-y-2">
        <Label htmlFor="market-password">Wallet password, for buying or listing</Label>
        <Input id="market-password" type="password" className="h-11 bg-card px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {voucher ? <p className="mt-4 rounded-2xl border bg-card px-4 py-3 text-sm">Voucher {voucher}. A partner would fulfill from this code.</p> : null}
      {error ? <p className="mt-4 text-sm text-[#9a3b28]">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {loading ? <p className="text-muted-foreground">Loading listings…</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            {tab === "flagship" ? "No flagship goods are on this network yet." : "No payee has listed an item yet."}
          </p>
        ) : null}
        {visible.map((listing) => {
          const href = status ? explorerUrl(status.mode, "object", listing.id) : null;
          return (
            <article key={listing.id} className="flex flex-col rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl">{listing.title}</h2>
                <p className="font-serif text-2xl">{formatUsd(listing.price)}</p>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{listing.detail}</p>
              <p className="mt-3 text-xs text-muted-foreground">Seller {shortAddress(listing.seller)}</p>
              <div className="mt-4 flex gap-2">
                <Button disabled={!listing.active || busyId !== null} onClick={() => buy(listing)}>
                  {busyId === listing.id ? "Paying…" : listing.active ? "Buy" : "Sold"}
                </Button>
                {href ? (
                  <Button asChild variant="ghost">
                    <a href={href} target="_blank" rel="noreferrer">
                      Object
                    </a>
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <form onSubmit={publish} className="mt-10 max-w-xl space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-serif text-2xl">List something you sell</h2>
        <p className="text-sm text-muted-foreground">You become a partner on the same board. Buyers pay the address that received your intent.</p>
        <div className="space-y-2">
          <Label htmlFor="title">Item</Label>
          <Input id="title" className="h-11 bg-background px-3" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="detail">What the buyer gets</Label>
          <Textarea id="detail" className="bg-background" value={detail} onChange={(event) => setDetail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price in USD</Label>
          <Input id="price" className="h-11 bg-background px-3" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
        </div>
        <Button className="h-11 rounded-full px-5" disabled={busyId !== null}>
          {busyId === "list" ? "Listing…" : "List on Sui"}
        </Button>
      </form>
    </div>
  );
}
