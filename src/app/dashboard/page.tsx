"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Link from "next/link";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1f3d", fontFamily: dmSans.style.fontFamily }}
    >
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
        >
          Dear · Neighbor
        </span>
        <SignOutButton>
          <button
            className="text-sm px-4 py-2 rounded-lg transition hover:brightness-110"
            style={{ color: "#0f1f3d", backgroundColor: "#c9a84c" }}
          >
            Sign out
          </button>
        </SignOutButton>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Welcome */}
        <h1
          className="text-4xl md:text-5xl font-semibold text-white mb-3"
          style={{ fontFamily: playfair.style.fontFamily }}
        >
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
        </h1>
        <p className="text-lg mb-10" style={{ color: "#94a3b8" }}>
          Ready to reach homeowners before they list?
        </p>

        {/* Start campaign CTA */}
        <Link
          href="/dashboard/new-campaign"
          className="inline-block px-8 py-4 rounded-lg font-semibold text-[#0f1f3d] text-lg transition hover:brightness-110 mb-16"
          style={{ backgroundColor: "#c9a84c" }}
        >
          + Start new campaign
        </Link>

        {/* Campaigns section */}
        <section>
          <h2
            className="text-sm font-medium tracking-widest uppercase mb-6"
            style={{ color: "#c9a84c" }}
          >
            Your campaigns
          </h2>
          <div
            className="rounded-xl p-8 text-center"
            style={{
              backgroundColor: "rgba(201, 168, 76, 0.08)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}
          >
            <p className="text-white mb-1" style={{ fontFamily: playfair.style.fontFamily }}>
              No campaigns yet.
            </p>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Start your first one above.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
