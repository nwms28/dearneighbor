"use client";

import { useEffect, useState, use } from "react";
import { DM_Sans, Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

type Screen = "hook" | "letter" | "form" | "confirm" | "declined";
type Timeline = "ready" | "few-months" | "exploring";

interface Lead {
  id: string;
  address: string;
  status: string;
  campaigns: {
    letter: string;
    neighborhood_name: string;
    buyer_name: string | null;
    buyer_city: string | null;
  };
}

// Extract buyer name from letter signature — looks at the last few non-empty lines
// for a closing word ("With", "Sincerely", "Regards", "Warmly", "Best", "Thanks")
// followed by a name on the next line.
function extractBuyerInfo(letter: string, neighborhood: string): { name: string; city: string } {
  let name = "A neighbor";
  const city = neighborhood || "your area";

  if (!letter) return { name, city };

  const lines = letter
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const closings = /^(with\b|sincerely|regards|warmly|best|thanks|cheers|yours)/i;

  // Walk from the end — the very last line is usually the name
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // If this line looks like a closing word, the name is the next line down
    if (closings.test(line)) {
      const candidate = lines[i + 1];
      if (candidate && /^[A-Z][a-zA-Z'\-.]+(?:\s+[A-Z][a-zA-Z'\-.]+)*$/.test(candidate)) {
        name = candidate.replace(/[,.]$/, "");
        return { name, city };
      }
    }
  }

  // Fallback — last line itself, if it looks like a name
  const lastLine = lines[lines.length - 1];
  if (lastLine && /^[A-Z][a-zA-Z'\-.]+(?:\s+[A-Z][a-zA-Z'\-.]+)*$/.test(lastLine)) {
    name = lastLine.replace(/[,.]$/, "");
  }

  return { name, city };
}

export default function HomeownerLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("hook");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timeline, setTimeline] = useState<Timeline | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/leads/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Lead not found");
        return res.json();
      })
      .then((data) => {
        console.log("[home] lead loaded:", JSON.stringify(data));
        setLead(data);
      })
      .catch(() => setError("This link is no longer valid."))
      .finally(() => setLoading(false));
  }, [token]);

  async function patchLead(body: Record<string, unknown>) {
    return fetch(`/api/leads/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function handleDecline() {
    await patchLead({ status: "declined" });
    setScreen("declined");
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name || !email) {
      setFormError("Name and email are required.");
      return;
    }
    if (!timeline) {
      setFormError("Please select a timeline.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await patchLead({
        status: "interested",
        homeownerName: name,
        homeownerEmail: email,
        homeownerPhone: phone,
        timeline,
      });
      if (!res.ok) throw new Error("Failed");

      // Fire-and-forget buyer notification — don't block the confirmation screen if it fails
      fetch("/api/notify-buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch((err) => console.error("[home] notify-buyer failed:", err));

      setScreen("confirm");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Prefer the buyer_name/buyer_city columns saved at campaign creation time;
  // fall back to parsing the letter if those weren't captured.
  let buyerInfo = { name: "A neighbor", city: "your area" };
  if (lead) {
    const parsed = extractBuyerInfo(lead.campaigns.letter, lead.campaigns.neighborhood_name);
    buyerInfo = {
      name: lead.campaigns.buyer_name ?? parsed.name,
      city: lead.campaigns.buyer_city ?? parsed.city,
    };
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "#94a3b8" }}>Loading…</p>
      </Shell>
    );
  }

  if (error || !lead) {
    return (
      <Shell>
        <p className="text-base" style={{ color: "#f87171" }}>
          {error || "Lead not found."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Screen 1 — Hook */}
      {screen === "hook" && (
        <div className="flex flex-col gap-6 w-full max-w-md">
          <div>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-semibold text-white leading-[1.05] mb-4"
              style={{ fontFamily: playfair.style.fontFamily }}
            >
              You have an interested home buyer
            </h1>
            <p className="text-lg" style={{ color: "#94a3b8" }}>
              <span className="text-white font-medium">{buyerInfo.name}</span> from{" "}
              <span className="text-white font-medium">{buyerInfo.city}</span> sent you a personal letter.
              No agent, no pressure.
            </p>
          </div>

          <div
            className="rounded-xl p-5 flex flex-col gap-2"
            style={{
              backgroundColor: "rgba(201, 168, 76, 0.08)",
              border: "2px solid #c9a84c",
            }}
          >
            <p className="text-lg font-semibold text-white" style={{ fontFamily: playfair.style.fontFamily }}>
              Selling direct could save you $20,000+ in realtor fees
            </p>
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              No 6% commission. Just a direct conversation.
            </p>
          </div>

          <button
            onClick={() => setScreen("letter")}
            className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 text-lg mt-2"
            style={{ backgroundColor: "#c9a84c" }}
          >
            Read their letter →
          </button>
        </div>
      )}

      {/* Screen 2 — Letter */}
      {screen === "letter" && (
        <div className="flex flex-col gap-6 w-full max-w-md">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}
          >
            <p
              className="text-base leading-relaxed whitespace-pre-wrap text-white"
              style={{ fontFamily: playfair.style.fontFamily }}
            >
              {lead.campaigns.letter || "Letter not available."}
            </p>
            <div className="mt-6 pt-4 border-t" style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#c9a84c" }}>
                Sent to
              </p>
              <p className="text-sm text-white">{lead.address}</p>
            </div>
          </div>

          <button
            onClick={() => setScreen("form")}
            className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 text-lg"
            style={{ backgroundColor: "#c9a84c" }}
          >
            I&rsquo;m interested in talking
          </button>

          <button
            onClick={handleDecline}
            className="text-sm text-center transition hover:opacity-80"
            style={{ color: "#64748b" }}
          >
            Not interested right now
          </button>
        </div>
      )}

      {/* Screen 3 — Form */}
      {screen === "form" && (
        <form onSubmit={handleSubmitForm} className="flex flex-col gap-5 w-full max-w-md">
          <h1
            className="text-2xl sm:text-3xl font-semibold text-white leading-tight"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            Great! Let {buyerInfo.name} know how to reach you
          </h1>

          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-base text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] placeholder:text-white/30"
              style={{ fontFamily: dmSans.style.fontFamily }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-base text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] placeholder:text-white/30"
              style={{ fontFamily: dmSans.style.fontFamily }}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-base text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] placeholder:text-white/30"
              style={{ fontFamily: dmSans.style.fontFamily }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "#c9a84c" }}>
              When could you sell?
            </p>
            <div className="flex flex-col gap-2">
              {([
                { id: "ready", label: "Ready soon" },
                { id: "few-months", label: "In a few months" },
                { id: "exploring", label: "Just exploring" },
              ] as const).map(({ id, label }) => {
                const selected = timeline === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTimeline(id)}
                    className="text-left px-4 py-3 rounded-lg text-sm transition"
                    style={{
                      backgroundColor: selected ? "rgba(201, 168, 76, 0.12)" : "rgba(255,255,255,0.03)",
                      border: selected ? "2px solid #c9a84c" : "2px solid rgba(255,255,255,0.08)",
                      color: "#ffffff",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {formError && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110 disabled:opacity-60 text-lg"
            style={{ backgroundColor: "#c9a84c" }}
          >
            {submitting ? "Sending…" : "Send my contact info →"}
          </button>
        </form>
      )}

      {/* Screen 4 — Confirmation */}
      {screen === "confirm" && (
        <div className="flex flex-col items-center text-center gap-6 w-full max-w-md">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(201, 168, 76, 0.12)", border: "2px solid #c9a84c" }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M7 18L14.5 25.5L29 11" stroke="#c9a84c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-semibold text-white leading-tight"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            You&rsquo;re all set!
          </h1>
          <p className="text-base" style={{ color: "#94a3b8" }}>
            {`${buyerInfo.name} will be in touch soon. `}You&rsquo;ve taken the first step toward a commission-free sale.
          </p>
          <div
            className="rounded-xl p-5 w-full"
            style={{
              backgroundColor: "rgba(201, 168, 76, 0.08)",
              border: "1px solid rgba(201, 168, 76, 0.25)",
            }}
          >
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              Based on average home values, selling direct could save you{" "}
              <span className="text-white font-semibold">$15,000–$25,000</span> in agent fees.
            </p>
          </div>
        </div>
      )}

      {/* Declined */}
      {screen === "declined" && (
        <div className="flex flex-col items-center text-center gap-4 w-full max-w-md">
          <h1
            className="text-2xl sm:text-3xl font-semibold text-white"
            style={{ fontFamily: playfair.style.fontFamily }}
          >
            Thanks for your time
          </h1>
          <p className="text-base" style={{ color: "#94a3b8" }}>
            We won&rsquo;t contact you again. Take care.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0f1f3d", fontFamily: dmSans.style.fontFamily }}
    >
      <header
        className="px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
        >
          Dear · Neighbor
        </span>
      </header>
      <main className="flex-1 flex flex-col items-center px-6 pt-16 sm:pt-24 pb-10">
        {children}
      </main>
    </div>
  );
}
