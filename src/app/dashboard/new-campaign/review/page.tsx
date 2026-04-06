"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { useCampaignStore, PER_LETTER_MAILING } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

export default function ReviewPage() {
  const store = useCampaignStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [mailingLoading, setMailingLoading] = useState(false);
  const [mailingError, setMailingError] = useState("");

  const confirmedCount = store.confirmedAddresses.length;
  const mailingCost = confirmedCount * PER_LETTER_MAILING;

  const letterPreview = store.generatedLetter
    ? store.generatedLetter.slice(0, 300) + (store.generatedLetter.length > 300 ? "…" : "")
    : null;

  const backHref = sessionId
    ? `/dashboard/new-campaign/addresses?session_id=${sessionId}`
    : "/dashboard/new-campaign/addresses";

  const sendHref = sessionId
    ? `/dashboard/new-campaign/send?session_id=${sessionId}`
    : "/dashboard/new-campaign/send";

  async function handleMailingCheckout() {
    setMailingLoading(true);
    setMailingError("");
    try {
      const res = await fetch("/api/create-mailing-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedCount }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Unknown error");
      router.push(data.checkoutUrl);
    } catch (err) {
      console.error(err);
      setMailingError("Could not start mailing checkout. Please try again.");
      setMailingLoading(false);
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
          Step 5 of 5 — Review your campaign
        </span>
        <Link href={backHref} className="text-sm" style={{ color: "#64748b" }}>
          ← Back to addresses
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 flex flex-col gap-8">

        {/* Summary card */}
        <section
          className="rounded-xl p-6 flex flex-col gap-5"
          style={{
            backgroundColor: "rgba(201, 168, 76, 0.06)",
            border: "1px solid rgba(201, 168, 76, 0.2)",
          }}
        >
          <h2
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "#c9a84c" }}
          >
            Campaign summary
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: "#64748b" }}>Neighborhood</p>
              <p className="text-white font-medium">{store.neighborhoodName || "—"}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "#64748b" }}>Confirmed addresses</p>
              <p className="text-white font-medium">{confirmedCount} homes</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "#64748b" }}>Delivery</p>
              <p className="text-white font-medium">
                {store.deliveryMethod === "mail" ? "Mail for me" : "Download PDFs"}
              </p>
            </div>
          </div>

          {letterPreview && (
            <div>
              <p className="text-xs mb-2" style={{ color: "#64748b" }}>Your letter</p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#94a3b8", fontFamily: playfair.style.fontFamily }}
              >
                &ldquo;{letterPreview}&rdquo;
              </p>
            </div>
          )}
        </section>

        {/* Confirmed addresses list */}
        {store.confirmedAddresses.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: "#c9a84c" }}
            >
              Confirmed addresses ({confirmedCount})
            </h2>
            <div
              className="rounded-xl overflow-hidden max-h-56 overflow-y-auto"
              style={{ border: "1px solid rgba(201, 168, 76, 0.2)" }}
            >
              {store.confirmedAddresses.map((address, i) => (
                <div
                  key={address}
                  className="px-5 py-3 text-sm text-white"
                  style={{
                    borderBottom:
                      i < store.confirmedAddresses.length - 1
                        ? "1px solid rgba(201,168,76,0.08)"
                        : "none",
                  }}
                >
                  {address}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA — conditional on delivery method */}
        {store.deliveryMethod === "mail" ? (
          <section className="flex flex-col gap-4">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(201, 168, 76, 0.2)" }}
            >
              <div
                className="flex justify-between items-center px-5 py-3 border-b"
                style={{ borderColor: "rgba(201, 168, 76, 0.1)" }}
              >
                <span className="text-sm" style={{ color: "#94a3b8" }}>
                  Mailing ({confirmedCount} letters × ${PER_LETTER_MAILING.toFixed(2)})
                </span>
                <span className="text-sm text-white">${mailingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center px-5 py-4">
                <span className="font-semibold text-white">Total due now</span>
                <span className="font-semibold text-lg" style={{ color: "#c9a84c" }}>
                  ${mailingCost.toFixed(2)}
                </span>
              </div>
            </div>

            {mailingError && (
              <p className="text-sm text-center" style={{ color: "#f87171" }}>
                {mailingError}
              </p>
            )}
            <button
              onClick={handleMailingCheckout}
              disabled={mailingLoading || confirmedCount === 0}
              className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 disabled:opacity-60 text-lg"
              style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
            >
              {mailingLoading ? "Redirecting to checkout…" : `Pay $${mailingCost.toFixed(2)} & send →`}
            </button>
          </section>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href={sendHref}
              className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 text-lg"
              style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
            >
              Download PDFs →
            </Link>
            <p className="text-xs text-center" style={{ color: "#64748b" }}>
              Your ready-to-print PDFs will be available on the next screen.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
