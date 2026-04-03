"use client";

import { useState } from "react";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export default function Home() {
  const [email, setEmail] = useState("");

  return (
    <div
      className={`${playfair.variable} ${dmSans.variable} min-h-screen flex flex-col items-center justify-center px-6 py-20`}
      style={{ backgroundColor: "#0f1f3d", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center text-center gap-8">
        {/* Eyebrow */}
        <p
          className="text-sm font-medium tracking-widest uppercase"
          style={{ color: "#c9a84c", fontFamily: "var(--font-dm-sans)" }}
        >
          Coming soon · dearneighbor.ai
        </p>

        {/* Logo */}
        <h2
          className="text-4xl md:text-5xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: "var(--font-playfair)" }}
        >
          Dear · Neighbor
        </h2>

        {/* Headline */}
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-white"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Your dream home isn&apos;t for sale yet. Let&apos;s change that.
        </h1>

        {/* Subheading */}
        <p
          className="text-lg md:text-xl leading-relaxed max-w-xl"
          style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}
        >
          Some people wait for the right listing to appear. Others write a
          letter. We make the letter — and send it to every door in the
          neighborhood.
        </p>

        {/* Email capture */}
        <div className="w-full max-w-md flex flex-col sm:flex-row gap-3 mt-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c] transition"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          />
          <button
            type="button"
            className="px-6 py-3 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 active:brightness-95 whitespace-nowrap"
            style={{
              backgroundColor: "#c9a84c",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Get early access
          </button>
        </div>

        {/* Privacy note */}
        <p
          className="text-sm"
          style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}
        >
          No spam. Just a note when the doors open.
        </p>

        {/* Quote box */}
        <div
          className="mt-4 w-full max-w-xl rounded-xl p-6 text-left"
          style={{ backgroundColor: "rgba(201, 168, 76, 0.08)", border: "1px solid rgba(201, 168, 76, 0.2)" }}
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
              fill="#c9a84c"
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
          <p
            className="text-sm font-medium"
            style={{ color: "#c9a84c", fontFamily: "var(--font-dm-sans)" }}
          >
            Jamie M. · First-time buyer · Ann Arbor, MI
          </p>
        </div>
      </div>
    </div>
  );
}
