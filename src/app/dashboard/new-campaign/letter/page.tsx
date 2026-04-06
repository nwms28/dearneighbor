"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { useCampaignStore } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

interface FormFields {
  name: string;
  city: string;
  whyNeighborhood: string;
  family: string;
  neighborType: string;
  memorableDetails: string;
}

interface ReturnAddressFields {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY_FORM: FormFields = {
  name: "",
  city: "",
  whyNeighborhood: "",
  family: "",
  neighborType: "",
  memorableDetails: "",
};

const EMPTY_RETURN: ReturnAddressFields = {
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
};

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs font-medium tracking-widest uppercase"
        style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
      >
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal" style={{ color: "#64748b" }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] transition resize-none";

export default function LetterPage() {
  const store = useCampaignStore();
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [returnAddr, setReturnAddr] = useState<ReturnAddressFields>(EMPTY_RETURN);
  const [saveAddrForFuture, setSaveAddrForFuture] = useState(true);
  const [letter, setLetter] = useState("");
  const [editableLetter, setEditableLetter] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [editing, setEditing] = useState(false);

  // Pre-fill return address from saved user profile
  useEffect(() => {
    fetch("/api/user/get-address")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ra = data?.returnAddress;
        if (ra && ra.street) {
          setReturnAddr({
            street: ra.street ?? "",
            unit: ra.unit ?? "",
            city: ra.city ?? "",
            state: ra.state ?? "",
            zip: ra.zip ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  function set(field: keyof FormFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function setAddr(field: keyof ReturnAddressFields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      if (field === "state") value = value.toUpperCase().slice(0, 2);
      if (field === "zip") value = value.replace(/[^0-9]/g, "").slice(0, 5);
      setReturnAddr((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setEditing(false);

    // Persist return address to the campaign store
    const ra = {
      street: returnAddr.street.trim(),
      unit: returnAddr.unit.trim() || undefined,
      city: returnAddr.city.trim(),
      state: returnAddr.state.trim(),
      zip: returnAddr.zip.trim(),
    };
    store.setReturnAddress(ra);

    // Optionally save to user profile for future campaigns
    if (saveAddrForFuture) {
      fetch("/api/user/save-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnAddress: ra }),
      }).catch((err) => console.error("[letter] save-address failed:", err));
    }

    try {
      const res = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.letter) throw new Error(data.error ?? "Unknown error");
      setLetter(data.letter);
      setEditableLetter(data.letter);
      store.setGeneratedLetter(data.letter);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  const displayLetter = editing ? editableLetter : letter;

  return (
    <div
      className="flex flex-col h-screen"
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
          Step 2 of 5 — Write your letter
        </span>
        <Link href="/dashboard/new-campaign" className="text-sm" style={{ color: "#64748b" }}>
          ← Back to map
        </Link>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT — form */}
        <div
          className="w-96 flex-shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
        >
          <form onSubmit={handleGenerate} className="flex flex-col gap-5 p-6">
            {/* Return address card — prominent, gold-bordered */}
            <div
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.06)",
                border: "2px solid #c9a84c",
              }}
            >
              <div className="flex flex-col gap-1">
                <h3
                  className="text-base font-semibold text-white"
                  style={{ fontFamily: playfair.style.fontFamily }}
                >
                  Your return address
                </h3>
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  This appears on every envelope and is how homeowners write back to you.
                </p>
              </div>

              <Field label="Street address">
                <input
                  type="text"
                  required
                  value={returnAddr.street}
                  onChange={setAddr("street")}
                  placeholder="123 Main St"
                  className={inputClass}
                  style={{ fontFamily: dmSans.style.fontFamily }}
                />
              </Field>

              <Field label="Apartment / unit" optional>
                <input
                  type="text"
                  value={returnAddr.unit}
                  onChange={setAddr("unit")}
                  placeholder="Apt 4B"
                  className={inputClass}
                  style={{ fontFamily: dmSans.style.fontFamily }}
                />
              </Field>

              <Field label="City">
                <input
                  type="text"
                  required
                  value={returnAddr.city}
                  onChange={setAddr("city")}
                  placeholder="Ann Arbor"
                  className={inputClass}
                  style={{ fontFamily: dmSans.style.fontFamily }}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={returnAddr.state}
                    onChange={setAddr("state")}
                    placeholder="MI"
                    className={inputClass}
                    style={{ fontFamily: dmSans.style.fontFamily }}
                  />
                </Field>
                <Field label="Zip">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={5}
                    pattern="[0-9]{5}"
                    value={returnAddr.zip}
                    onChange={setAddr("zip")}
                    placeholder="48103"
                    className={inputClass}
                    style={{ fontFamily: dmSans.style.fontFamily }}
                  />
                </Field>
              </div>

              <label
                className="flex items-center gap-2 text-sm cursor-pointer mt-1"
                style={{ color: "#e2e8f0", fontFamily: dmSans.style.fontFamily }}
              >
                <input
                  type="checkbox"
                  checked={saveAddrForFuture}
                  onChange={(e) => setSaveAddrForFuture(e.target.checked)}
                  className="h-4 w-4 accent-[#c9a84c]"
                />
                Save this address for future campaigns
              </label>
            </div>

            <h2
              className="text-lg font-semibold text-white"
              style={{ fontFamily: playfair.style.fontFamily }}
            >
              Your story
            </h2>

            <Field label="Your full name">
              <input
                type="text"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="Jane Smith"
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <Field label="Your current city">
              <input
                type="text"
                required
                value={form.city}
                onChange={set("city")}
                placeholder="Chicago, IL"
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <Field label="Why do you want to live in this neighborhood?">
              <textarea
                required
                rows={3}
                value={form.whyNeighborhood}
                onChange={set("whyNeighborhood")}
                placeholder="We've been coming to this neighborhood for years for the farmers market and it's always felt like home..."
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <Field label="Tell us about your family">
              <textarea
                required
                rows={3}
                value={form.family}
                onChange={set("family")}
                placeholder="My partner and I have two young kids, ages 4 and 7, and a golden retriever named Biscuit..."
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <Field label="What kind of neighbor will you be?">
              <textarea
                required
                rows={3}
                value={form.neighborType}
                onChange={set("neighborType")}
                placeholder="We love block parties and always have extra tomatoes from the garden to share..."
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <Field label="Any personal details that make you memorable?" optional>
              <textarea
                rows={2}
                value={form.memorableDetails}
                onChange={set("memorableDetails")}
                placeholder="We restored a Victorian in our current neighborhood and would love to do the same here..."
                className={inputClass}
                style={{ fontFamily: dmSans.style.fontFamily }}
              />
            </Field>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full px-5 py-3 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 disabled:opacity-60 mt-2"
              style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
            >
              {status === "loading" ? "Generating…" : "Generate my letter"}
            </button>

            {status === "error" && (
              <p className="text-sm text-center" style={{ color: "#f87171" }}>
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        </div>

        {/* RIGHT — preview */}
        <div className="flex-1 flex flex-col overflow-y-auto p-8 gap-6">
          <h2
            className="text-lg font-semibold text-white flex-shrink-0"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            Letter preview
          </h2>

          {status === "idle" && (
            <div
              className="flex-1 flex items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.05)",
                border: "1px solid rgba(201, 168, 76, 0.15)",
                minHeight: "300px",
              }}
            >
              <p className="text-center" style={{ color: "#64748b", fontFamily: dmSans.style.fontFamily }}>
                Your letter will appear here.
              </p>
            </div>
          )}

          {status === "loading" && (
            <div
              className="flex-1 flex items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.05)",
                border: "1px solid rgba(201, 168, 76, 0.15)",
                minHeight: "300px",
              }}
            >
              <p style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}>
                Writing your letter…
              </p>
            </div>
          )}

          {status === "done" && (
            <>
              {/* Letter body */}
              <div
                className="rounded-xl p-7"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                }}
              >
                {editing ? (
                  <textarea
                    value={editableLetter}
                    onChange={(e) => setEditableLetter(e.target.value)}
                    className="w-full bg-transparent text-white leading-relaxed focus:outline-none resize-none"
                    style={{
                      fontFamily: playfair.style.fontFamily,
                      fontSize: "1rem",
                      minHeight: "320px",
                    }}
                  />
                ) : (
                  <p
                    className="text-white leading-relaxed whitespace-pre-wrap"
                    style={{ fontFamily: playfair.style.fontFamily }}
                  >
                    {displayLetter}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                <Link
                  href="/dashboard/new-campaign/checkout"
                  className="px-6 py-3 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 whitespace-nowrap"
                  style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
                >
                  This looks great — next step →
                </Link>

                <button
                  onClick={handleGenerate}
                  className="px-5 py-3 rounded-lg font-semibold transition hover:brightness-110 whitespace-nowrap"
                  style={{
                    color: "#c9a84c",
                    border: "1px solid rgba(201, 168, 76, 0.4)",
                    backgroundColor: "transparent",
                    fontFamily: dmSans.style.fontFamily,
                  }}
                >
                  Regenerate
                </button>

                <button
                  onClick={() => {
                    if (editing) {
                      setLetter(editableLetter);
                      store.setGeneratedLetter(editableLetter);
                    }
                    setEditing((v) => !v);
                  }}
                  className="text-sm transition"
                  style={{ color: "#64748b", fontFamily: dmSans.style.fontFamily }}
                >
                  {editing ? "Done editing" : "Edit letter"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
