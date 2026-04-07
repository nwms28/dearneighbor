"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { useCampaignStore } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

const CAMPAIGN_FEE = 99.0;

const INCLUDED = [
  "Real address lookup for your drawn area (up to 100 homes)",
  "Your personalized letter ready to send",
  "Ability to confirm and exclude any addresses",
  "A unique QR code on every letter — homeowners scan to respond directly to you",
];

export default function CheckoutPage() {
  const store = useCampaignStore();
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  async function handleCheckout() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Unknown error");
      router.push(data.checkoutUrl);
    } catch (err) {
      console.error(err);
      setCheckoutError("Could not start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "#0f1f3d", fontFamily: dmSans.style.fontFamily }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
        >
          Dear · Neighbor
        </span>
        <span className="text-sm" style={{ color: "#94a3b8" }}>
          Step 3 of 5 — Confirm &amp; pay
        </span>
        <Link href="/dashboard/new-campaign/letter" className="text-sm" style={{ color: "#64748b" }}>
          ← Back to letter
        </Link>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-14 flex flex-col items-center gap-10">

        {/* Headline */}
        <div className="text-center">
          <h1
            className="text-3xl font-semibold text-white mb-3"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            Launch your campaign
          </h1>
          <p className="text-base" style={{ color: "#94a3b8" }}>
            You&apos;re one step away from reaching homeowners before they list.
          </p>
        </div>

        {/* What's included */}
        <div
          className="w-full rounded-xl p-6 flex flex-col gap-4"
          style={{
            backgroundColor: "rgba(201, 168, 76, 0.06)",
            border: "1px solid rgba(201, 168, 76, 0.25)",
          }}
        >
          <p
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "#c9a84c" }}
          >
            What&apos;s included
          </p>
          <ul className="flex flex-col gap-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 font-semibold" style={{ color: "#c9a84c" }}>
                  ✓
                </span>
                <span className="text-sm text-white">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Price block — founding member rate */}
        <div className="flex flex-col items-center gap-2">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "#c9a84c" }}
          >
            Founding Member Rate
          </p>
          <p
            className="text-7xl font-semibold text-white"
            style={{ fontFamily: playfair.style.fontFamily, letterSpacing: "-0.02em" }}
          >
            $99
          </p>
          <p className="text-sm text-center" style={{ color: "#94a3b8" }}>
            Regular price{" "}
            <span className="line-through" style={{ color: "#64748b" }}>$149</span>{" "}
            · Locked in for life
          </p>
          <p className="text-xs text-center mt-1" style={{ color: "#c9a84c" }}>
            🔒 Early access pricing for the first 25 customers
          </p>
          <p className="text-sm text-center mt-2" style={{ color: "#64748b" }}>
            One-time campaign fee. Mailing is separate when you&apos;re ready to send.
          </p>
        </div>

        {/* CTA */}
        <div className="w-full flex flex-col items-center gap-3">
          {checkoutError && (
            <p className="text-sm text-center" style={{ color: "#f87171" }}>
              {checkoutError}
            </p>
          )}
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 disabled:opacity-60 text-lg"
            style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
          >
            {checkoutLoading ? "Redirecting…" : "Unlock my addresses →"}
          </button>
          <p className="text-xs text-center max-w-sm" style={{ color: "#64748b" }}>
            Mailing is $2.99/letter, paid separately after you confirm your address list. Download PDFs is always free.
          </p>
        </div>
      </main>
    </div>
  );
}
