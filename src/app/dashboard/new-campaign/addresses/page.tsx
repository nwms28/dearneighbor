"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { useCampaignStore, PER_LETTER_MAILING, type DeliveryMethod } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

interface ManualAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY_MANUAL: ManualAddress = { street: "", city: "", state: "", zip: "" };

function AddressesPageContent() {
  const store = useCampaignStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod>("mail");
  const [manualAddresses, setManualAddresses] = useState<string[]>([]);
  // Local working copy of geocoded addresses (deduped, mutable for zip fixes)
  const [storeAddresses, setStoreAddresses] = useState<string[]>([]);
  const [continueError, setContinueError] = useState("");
  // In-progress zip entries keyed by the current address string. Committed on blur/Enter.
  const [pendingZips, setPendingZips] = useState<Record<string, string>>({});

  // Manual entry form state
  const [formOpen, setFormOpen] = useState(false);
  const [manual, setManual] = useState<ManualAddress>(EMPTY_MANUAL);
  const [manualError, setManualError] = useState("");
  const newAddressRef = useRef<HTMLLabelElement | null>(null);

  // Hydrate selection from store addresses once loaded — dedupe by full string
  useEffect(() => {
    if (store.addresses.length > 0 && !hydrated) {
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const addr of store.addresses) {
        const key = addr.trim();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(addr);
        }
      }
      setStoreAddresses(deduped);
      setSelected(new Set(deduped));
      setHydrated(true);
    }
  }, [store.addresses, hydrated]);

  // True when an address has no 5-digit zip at the end (e.g. ends with "ST" or "ST,")
  function isMissingZip(address: string): boolean {
    return !/\d{5}(?:-\d{4})?\s*$/.test(address.trim());
  }

  function updateAddress(oldAddress: string, newAddress: string) {
    if (oldAddress === newAddress) return;
    setStoreAddresses((prev) => prev.map((a) => (a === oldAddress ? newAddress : a)));
    setManualAddresses((prev) => prev.map((a) => (a === oldAddress ? newAddress : a)));
    setSelected((prev) => {
      if (!prev.has(oldAddress)) return prev;
      const next = new Set(prev);
      next.delete(oldAddress);
      next.add(newAddress);
      return next;
    });
  }

  function commitZip(address: string) {
    const zip = (pendingZips[address] ?? "").replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) return;
    const base = address.replace(/[,\s]+$/, "");
    const next = `${base} ${zip}`;
    updateAddress(address, next);
    setPendingZips((prev) => {
      const copy = { ...prev };
      delete copy[address];
      return copy;
    });
  }

  // Hydrate delivery from store
  useEffect(() => {
    if (store.deliveryMethod) setDelivery(store.deliveryMethod);
  }, [store.deliveryMethod]);

  const allAddresses = [...storeAddresses, ...manualAddresses];
  const allChecked = selected.size === allAddresses.length && allAddresses.length > 0;
  const noneChecked = selected.size === 0;
  const mailingCost = selected.size * PER_LETTER_MAILING;

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allAddresses));
    }
  }

  function toggle(address: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  }

  function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    if (!manual.street || !manual.city || !manual.state || !manual.zip) {
      setManualError("All fields are required.");
      return;
    }
    const formatted = `${manual.street}, ${manual.city} ${manual.state} ${manual.zip}`;
    setManualAddresses((prev) => [...prev, formatted]);
    setSelected((prev) => new Set([...prev, formatted]));
    setManual(EMPTY_MANUAL);
    setFormOpen(false);
    // Scroll to newly added address after render
    setTimeout(() => newAddressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function handleContinue() {
    const confirmed = allAddresses.filter((a) => selected.has(a));
    const stillMissing = confirmed.some(isMissingZip);
    if (stillMissing) {
      setContinueError("Please add zip codes to highlighted addresses before continuing.");
      return;
    }
    setContinueError("");
    store.setConfirmedAddresses(confirmed);
    store.setDeliveryMethod(delivery);
    const dest = sessionId
      ? `/dashboard/new-campaign/review?session_id=${sessionId}`
      : "/dashboard/new-campaign/review";
    router.push(dest);
  }

  const inputStyle = {
    backgroundColor: "#0f1f3d",
    color: "#ffffff",
    fontFamily: dmSans.style.fontFamily,
  };

  const fieldClass =
    "w-full px-4 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] transition placeholder:text-white/30";

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
          Step 4 of 5 — Confirm addresses
        </span>
        <div className="w-32" />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10 flex flex-col gap-6">
        {/* Neighborhood heading */}
        <div>
          <h1
            className="text-2xl font-semibold text-white mb-1"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            {store.neighborhoodName || "Your Selected Area"}
          </h1>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            Select which addresses you want to include in your campaign.
          </p>
        </div>

        {/* Controls bar */}
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{
            backgroundColor: "rgba(201, 168, 76, 0.06)",
            border: "1px solid rgba(201, 168, 76, 0.2)",
          }}
        >
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-[#c9a84c]"
            />
            <span className="text-sm font-medium text-white">Select all</span>
          </label>
          <span className="text-sm font-semibold" style={{ color: "#c9a84c" }}>
            {selected.size} of {allAddresses.length} selected
          </span>
        </div>

        {/* Address list */}
        {allAddresses.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-xl py-16"
            style={{ border: "1px dashed rgba(201,168,76,0.2)" }}
          >
            <p className="text-sm" style={{ color: "#64748b" }}>
              No addresses found. Go back and draw your neighborhood boundary.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(201, 168, 76, 0.2)" }}
          >
            {allAddresses.map((address, i) => {
              const checked = selected.has(address);
              const isManual = manualAddresses.includes(address);
              const isLast = i === allAddresses.length - 1;
              const missingZip = isMissingZip(address);
              return (
                <label
                  key={address}
                  ref={isManual && address === manualAddresses[manualAddresses.length - 1] ? newAddressRef : null}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer transition hover:bg-white/[0.03]"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid rgba(201,168,76,0.08)",
                    ...inputStyle,
                    backgroundColor: missingZip ? "rgba(201,168,76,0.06)" : inputStyle.backgroundColor,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(address)}
                    className="w-4 h-4 rounded accent-[#c9a84c] flex-shrink-0"
                  />
                  <span className="text-sm text-white flex-1">{address}</span>
                  {missingZip && (
                    <>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold"
                        style={{ backgroundColor: "rgba(201,168,76,0.18)", color: "#c9a84c" }}
                        title="Missing zip code"
                      >
                        ⚠️ Missing zip
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="Add zip code"
                        value={pendingZips[address] ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const zip = e.target.value.replace(/\D/g, "").slice(0, 5);
                          setPendingZips((prev) => ({ ...prev, [address]: zip }));
                        }}
                        onBlur={() => commitZip(address)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitZip(address);
                          }
                        }}
                        className="w-28 px-2 py-1 rounded text-xs font-semibold flex-shrink-0 outline-none"
                        style={{
                          backgroundColor: "rgba(15,31,61,0.8)",
                          color: "#c9a84c",
                          border: "1px solid #c9a84c",
                          fontFamily: dmSans.style.fontFamily,
                        }}
                      />
                    </>
                  )}
                  {isManual && !missingZip && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#c9a84c" }}
                    >
                      manually added
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {/* Manual address entry */}
        <div>
          {!formOpen ? (
            <button
              onClick={() => setFormOpen(true)}
              className="text-sm font-medium transition hover:opacity-80"
              style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
            >
              + Add an address manually
            </button>
          ) : (
            <div
              className="rounded-xl p-5 flex flex-col gap-4"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.06)",
                border: "1px solid rgba(201, 168, 76, 0.25)",
              }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: "#c9a84c" }}
              >
                Add an address manually
              </p>

              <form onSubmit={handleAddManual} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Street address"
                  value={manual.street}
                  onChange={(e) => setManual((p) => ({ ...p, street: e.target.value }))}
                  className={fieldClass}
                  style={{ fontFamily: dmSans.style.fontFamily }}
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={manual.city}
                    onChange={(e) => setManual((p) => ({ ...p, city: e.target.value }))}
                    className={`${fieldClass} col-span-1`}
                    style={{ fontFamily: dmSans.style.fontFamily }}
                  />
                  <input
                    type="text"
                    placeholder="ST"
                    maxLength={2}
                    value={manual.state}
                    onChange={(e) => setManual((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                    className={fieldClass}
                    style={{ fontFamily: dmSans.style.fontFamily }}
                  />
                  <input
                    type="text"
                    placeholder="Zip"
                    maxLength={5}
                    value={manual.zip}
                    onChange={(e) => setManual((p) => ({ ...p, zip: e.target.value.replace(/\D/g, "") }))}
                    className={fieldClass}
                    style={{ fontFamily: dmSans.style.fontFamily }}
                  />
                </div>

                {manualError && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{manualError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0f1f3d] transition hover:brightness-110"
                    style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
                  >
                    Add address
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormOpen(false); setManual(EMPTY_MANUAL); setManualError(""); }}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition hover:opacity-80"
                    style={{ color: "#64748b", fontFamily: dmSans.style.fontFamily }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Delivery method selection */}
        <section className="flex flex-col gap-3">
          <h2
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
          >
            How would you like to send?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  id: "mail" as DeliveryMethod,
                  title: "Mail for me",
                  badge: "Recommended",
                  description: `$${PER_LETTER_MAILING.toFixed(2)}/letter — we print and mail every letter.`,
                },
                {
                  id: "download" as DeliveryMethod,
                  title: "Download PDFs",
                  badge: "Free",
                  description: "Download ready-to-print PDFs and deliver yourself.",
                },
              ] as const
            ).map(({ id, title, badge, description }) => {
              const isSelected = delivery === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDelivery(id)}
                  className="text-left rounded-xl p-5 flex flex-col gap-2 transition"
                  style={{
                    backgroundColor: isSelected ? "rgba(201, 168, 76, 0.12)" : "rgba(255,255,255,0.03)",
                    border: isSelected ? "2px solid #c9a84c" : "2px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{title}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: "rgba(201, 168, 76, 0.15)", color: "#c9a84c" }}
                    >
                      {badge}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>{description}</p>
                </button>
              );
            })}
          </div>

          {/* Live mailing cost */}
          {delivery === "mail" && selected.size > 0 && (
            <div
              className="flex justify-between items-center rounded-lg px-4 py-3 mt-1"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.06)",
                border: "1px solid rgba(201, 168, 76, 0.2)",
              }}
            >
              <span className="text-sm" style={{ color: "#94a3b8" }}>
                Mailing cost ({selected.size} × ${PER_LETTER_MAILING.toFixed(2)})
              </span>
              <span className="text-sm font-semibold text-white">
                ${mailingCost.toFixed(2)}
              </span>
            </div>
          )}
        </section>

        {/* Continue CTA */}
        <div className="flex flex-col gap-3 pt-2 pb-8">
          {continueError && (
            <p className="text-sm text-center" style={{ color: "#f87171" }}>
              {continueError}
            </p>
          )}
          <button
            onClick={handleContinue}
            disabled={noneChecked}
            className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-lg"
            style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
          >
            Continue with {selected.size} address{selected.size !== 1 ? "es" : ""} →
          </button>
        </div>
      </main>
    </div>
  );
}

export default function AddressesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AddressesPageContent />
    </Suspense>
  );
}
