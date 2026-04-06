"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { useCampaignStore } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

type SaveState = "saving" | "done" | "error";

function SendPageContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const store = useCampaignStore();
  const hasSaved = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("saving");
  const [campaign, setCampaign] = useState<{
    neighborhood_name?: string;
    address_count?: number;
    delivery_method?: string;
  } | null>(null);

  // Keep a ref that always reflects the latest store values.
  // We read from this ref (not the reactive store) inside the save effect so the
  // captured values can't be cleared before the fetch completes.
  const storeSnapshot = useRef({
    neighborhoodName: store.neighborhoodName,
    addresses: store.addresses,
    confirmedAddresses: store.confirmedAddresses,
    generatedLetter: store.generatedLetter,
    deliveryMethod: store.deliveryMethod,
    returnAddress: store.returnAddress,
  });
  // Keep the snapshot up-to-date as the store hydrates from localStorage
  storeSnapshot.current = {
    neighborhoodName: store.neighborhoodName,
    addresses: store.addresses,
    confirmedAddresses: store.confirmedAddresses,
    generatedLetter: store.generatedLetter,
    deliveryMethod: store.deliveryMethod,
    returnAddress: store.returnAddress,
  };

  useEffect(() => {
    console.log("[send] store snapshot on mount:", storeSnapshot.current);
  }, []);

  useEffect(() => {
    // Wait until Clerk has loaded the user before firing
    if (!user) return;

    // Prevent double-save from React strict mode double-invocation
    if (hasSaved.current) return;

    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setSaveState("error");
      return;
    }

    const snap = storeSnapshot.current;
    const payload = {
      sessionId,
      userId: user.id,
      neighborhoodName: snap.neighborhoodName,
      addresses: snap.addresses,
      confirmedAddresses: snap.confirmedAddresses,
      generatedLetter: snap.generatedLetter,
      deliveryMethod: snap.deliveryMethod,
      returnAddress: snap.returnAddress,
    };

    console.log("[send] firing save with payload:", {
      sessionId,
      userId: user.id,
      neighborhoodName: snap.neighborhoodName,
      addressesCount: snap.addresses?.length,
      confirmedAddressesCount: snap.confirmedAddresses?.length,
      generatedLetterLength: snap.generatedLetter?.length,
      deliveryMethod: snap.deliveryMethod,
    });

    hasSaved.current = true;

    fetch("/api/campaigns/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("[send] /api/campaigns/save failed:", res.status, res.statusText);
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCampaign(data.campaign);
        setSaveState("done");
        store.clearCampaign();
      })
      .catch((err) => {
        console.error("[send] Failed to save campaign:", err);
        setSaveState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const neighborhoodName = campaign?.neighborhood_name ?? store.neighborhoodName ?? "—";
  const addressCount = campaign?.address_count ?? store.confirmedAddresses.length ?? store.addresses.length ?? 0;
  const deliveryMethod = campaign?.delivery_method ?? store.deliveryMethod ?? "mail";
  const deliveryLabel = deliveryMethod === "mail" ? "Mail for me" : "Download PDFs";

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
          Campaign launched
        </span>
        <div className="w-32" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {saveState === "saving" && (
          <p className="text-lg" style={{ color: "#94a3b8" }}>
            Confirming your payment…
          </p>
        )}

        {saveState === "error" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg" style={{ color: "#f87171" }}>
              Something went wrong saving your campaign.
            </p>
            <Link
              href="/dashboard"
              className="text-sm"
              style={{ color: "#c9a84c" }}
            >
              Go to dashboard →
            </Link>
          </div>
        )}

        {saveState === "done" && (
          <>
            {/* Checkmark */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
              style={{ backgroundColor: "rgba(201, 168, 76, 0.12)", border: "2px solid #c9a84c" }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7 18L14.5 25.5L29 11"
                  stroke="#c9a84c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Heading */}
            <h1
              className="text-4xl md:text-5xl font-semibold text-white mb-4"
              style={{ fontFamily: playfair.style.fontFamily }}
            >
              Your campaign is live!
            </h1>
            <p className="text-lg max-w-md mb-12" style={{ color: "#94a3b8" }}>
              {deliveryMethod === "mail"
                ? "We\u2019re preparing your letters. You\u2019ll receive a confirmation email when they\u2019re on their way."
                : "Your PDFs are being prepared. Check your email for the download link."}
            </p>

            {/* Campaign summary card */}
            <div
              className="rounded-xl p-6 w-full max-w-sm text-left mb-10"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.06)",
                border: "1px solid rgba(201, 168, 76, 0.2)",
              }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase mb-4"
                style={{ color: "#c9a84c" }}
              >
                Campaign details
              </p>
              {[
                { label: "Neighborhood", value: neighborhoodName },
                { label: "Addresses", value: `${addressCount} homes` },
                { label: "Delivery", value: deliveryLabel },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2 border-b last:border-0"
                  style={{ borderColor: "rgba(201, 168, 76, 0.1)" }}
                >
                  <span className="text-sm" style={{ color: "#64748b" }}>{label}</span>
                  <span className="text-sm text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <Link
                href="/dashboard"
                className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 text-lg"
                style={{ backgroundColor: "#c9a84c" }}
              >
                Go to dashboard →
              </Link>
              <Link
                href="/dashboard/new-campaign"
                className="text-sm transition hover:opacity-80"
                style={{ color: "#64748b" }}
              >
                Start another campaign
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SendPageContent />
    </Suspense>
  );
}
