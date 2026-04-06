"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const NAVY = "#0f1f3d";
const GOLD = "#c9a84c";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs sm:text-sm font-medium tracking-widest uppercase mb-3"
      style={{ color: GOLD, fontFamily: "var(--font-dm-sans)" }}
    >
      {children}
    </p>
  );
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-white mb-12"
      style={{ fontFamily: "var(--font-playfair)" }}
    >
      {children}
    </h2>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (email) {
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
    router.push("/sign-up");
  }

  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} min-h-screen`}
      style={{ backgroundColor: NAVY, fontFamily: "var(--font-dm-sans)" }}
    >
      {/* ─────────────────────────── Section 1 — Hero ─────────────────────────── */}
      <section className="px-6 py-20 md:py-28 flex flex-col items-center text-center">
        <div className="w-full max-w-3xl flex flex-col items-center gap-8">
          <p
            className="text-sm font-medium tracking-widest uppercase"
            style={{ color: GOLD }}
          >
            Coming soon · dearneighbor.ai
          </p>

          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight"
            style={{ color: GOLD, fontFamily: "var(--font-playfair)" }}
          >
            Dear · Neighbor
          </h2>

          <h1
            className="text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight text-white"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Win the home before it&apos;s for sale.
          </h1>

          <p
            className="text-lg md:text-xl leading-relaxed max-w-2xl"
            style={{ color: "#94a3b8" }}
          >
            Draw a neighborhood on a map, write a personal letter, and reach
            homeowners directly — before they ever call an agent.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <Link
              href="/sign-up"
              className="px-8 py-4 rounded-lg font-semibold text-[#0f1f3d] text-lg transition hover:brightness-110 text-center"
              style={{ backgroundColor: GOLD }}
            >
              Start for $49 →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 rounded-lg font-medium text-base transition hover:brightness-125 text-center"
              style={{ color: GOLD }}
            >
              See how it works ↓
            </a>
          </div>

          {/* Trust signals */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-x-6 gap-y-2 mt-4 text-sm" style={{ color: "#94a3b8" }}>
            <span>✓ Real addresses from public records</span>
            <span className="hidden sm:inline" style={{ color: "#475569" }}>·</span>
            <span>✓ Letters printed &amp; mailed for you</span>
            <span className="hidden sm:inline" style={{ color: "#475569" }}>·</span>
            <span>✓ Instant notifications when homeowners respond</span>
          </div>

          {/* Existing testimonial quote */}
          <div
            className="mt-8 w-full max-w-xl rounded-xl p-6 text-left"
            style={{
              backgroundColor: "rgba(201, 168, 76, 0.08)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}
          >
            <svg
              className="mb-4 opacity-60"
              width="28"
              height="20"
              viewBox="0 0 28 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 20V12.667C0 10.741 0.37 8.963 1.111 7.333 1.852 5.704 2.889 4.296 4.222 3.111 5.556 1.926 7.111 1.037 8.889.444L10.222 2.667C8.815 3.185 7.63 4 6.667 5.111 5.704 6.222 5.148 7.481 5 8.889H10V20H0ZM18 20V12.667c0-1.926.37-3.704 1.111-5.334.741-1.63 1.778-3.037 3.111-4.222C23.556 1.926 25.111 1.037 26.889.444L28.222 2.667c-1.407.518-2.592 1.333-3.555 2.444C23.704 6.222 23.148 7.481 23 8.889H28V20H18Z"
                fill={GOLD}
              />
            </svg>
            <p
              className="text-base md:text-lg leading-relaxed text-white/85 mb-5"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              A house in our target neighborhood received over 40 offers in three
              days. We had already mailed letters to every homeowner on the street
              two months earlier. When one owner decided to sell quietly — before
              listing — she called us first. We closed without ever competing.
            </p>
            <p className="text-sm font-medium" style={{ color: GOLD }}>
              Jamie M. · First-time buyer · Ann Arbor, MI
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────── Section 2 — How it works ─────────────────────── */}
      <section
        id="how-it-works"
        className="px-6 py-20 md:py-28"
        style={{ borderTop: "1px solid rgba(201, 168, 76, 0.15)" }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <SectionLabel>How it works</SectionLabel>
          <SectionHeadline>Three steps to reach homeowners before they list</SectionHeadline>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {[
              {
                n: "1",
                title: "Draw your neighborhood",
                body: "Use our map to draw any area. We pull real addresses from public property records automatically.",
              },
              {
                n: "2",
                title: "Write your letter",
                body: "Our AI writes a personal, heartfelt letter in minutes based on your story. You review every word.",
              },
              {
                n: "3",
                title: "We handle the rest",
                body: "We print, stuff, stamp and mail every letter — each with a unique QR code. Get instant email alerts when homeowners respond.",
              },
            ].map(({ n, title, body }) => (
              <div
                key={n}
                className="rounded-xl p-7 text-left flex flex-col gap-3"
                style={{
                  backgroundColor: "rgba(201, 168, 76, 0.05)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                }}
              >
                <span
                  className="text-5xl font-bold leading-none"
                  style={{ color: GOLD, fontFamily: "var(--font-playfair)" }}
                >
                  {n}
                </span>
                <h3
                  className="text-xl font-semibold text-white mt-2"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── Section 3 — Skip the commission ──────────────────── */}
      <section
        className="px-6 py-20 md:py-28"
        style={{ borderTop: "1px solid rgba(201, 168, 76, 0.15)" }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <SectionLabel>The Dear Neighbor advantage</SectionLabel>
          <SectionHeadline>Skip the 6% commission</SectionHeadline>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {/* Traditional */}
            <div
              className="rounded-xl p-7"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <h3
                className="text-xl font-semibold text-white mb-5"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Traditional buying
              </h3>
              <ul className="flex flex-col gap-3">
                {[
                  "Compete with dozens of buyers",
                  "Wait for listings to appear",
                  "Pay 6% in agent fees",
                  "Miss off-market opportunities",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "#94a3b8" }}>
                    <span className="flex-shrink-0">❌</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dear Neighbor */}
            <div
              className="rounded-xl p-7"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.08)",
                border: "2px solid #c9a84c",
              }}
            >
              <h3
                className="text-xl font-semibold mb-5"
                style={{ color: GOLD, fontFamily: "var(--font-playfair)" }}
              >
                Dear Neighbor
              </h3>
              <ul className="flex flex-col gap-3">
                {[
                  "Be the only buyer they talk to",
                  "Reach homeowners before they list",
                  "No agent commission needed",
                  "Direct conversation = better deals",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white">
                    <span className="flex-shrink-0 font-bold" style={{ color: GOLD }}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── Section 4 — Pricing ─────────────────────────── */}
      <section
        id="pricing"
        className="px-6 py-20 md:py-28"
        style={{ borderTop: "1px solid rgba(201, 168, 76, 0.15)" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <SectionLabel>Simple pricing</SectionLabel>
          <SectionHeadline>Pay only for what you send</SectionHeadline>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {[
              {
                price: "$49",
                unit: "per campaign",
                body: "Address lookup, AI letter writing, and up to 100 homes. One-time fee per neighborhood.",
              },
              {
                price: "$2.99",
                unit: "per letter",
                body: "We print, stuff, stamp and mail every letter. Or download PDFs free and deliver yourself.",
              },
            ].map(({ price, unit, body }) => (
              <div
                key={price}
                className="rounded-xl p-7"
                style={{
                  backgroundColor: "rgba(201, 168, 76, 0.06)",
                  border: "1px solid rgba(201, 168, 76, 0.25)",
                }}
              >
                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className="text-5xl font-semibold"
                    style={{ color: GOLD, fontFamily: "var(--font-playfair)" }}
                  >
                    {price}
                  </span>
                  <span className="text-sm" style={{ color: "#94a3b8" }}>
                    {unit}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm mt-8" style={{ color: "#64748b" }}>
            No subscriptions. No hidden fees. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ─────────────────────── Section 5 — Email capture ─────────────────────── */}
      <section
        className="px-6 py-20 md:py-28"
        style={{ borderTop: "1px solid rgba(201, 168, 76, 0.15)" }}
      >
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-white"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Get early access
          </h2>
          <p className="text-lg" style={{ color: "#94a3b8" }}>
            Join home buyers getting off-market access before everyone else.
          </p>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md flex flex-col sm:flex-row gap-3 mt-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] transition"
            />
            <button
              type="submit"
              suppressHydrationWarning
              className="px-6 py-3 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 active:brightness-95 whitespace-nowrap text-center"
              style={{ backgroundColor: GOLD }}
            >
              Get early access
            </button>
          </form>
          <p className="text-sm" style={{ color: "#64748b" }}>
            No spam. Just a note when the doors open.
          </p>
        </div>
      </section>

      {/* ─────────────────────────── Section 6 — Footer ─────────────────────────── */}
      <footer
        className="px-6 py-10"
        style={{ borderTop: "1px solid rgba(201, 168, 76, 0.15)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: GOLD, fontFamily: "var(--font-playfair)" }}
          >
            Dear · Neighbor
          </span>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "#94a3b8" }}>
            <a href="#how-it-works" className="hover:brightness-125">How it works</a>
            <a href="#pricing" className="hover:brightness-125">Pricing</a>
            <Link href="/sign-in" className="hover:brightness-125">Sign in</Link>
            <Link href="/sign-up" className="hover:brightness-125">Sign up</Link>
          </nav>

          <p className="text-xs" style={{ color: "#64748b" }}>
            © 2026 Dear Neighbor. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
