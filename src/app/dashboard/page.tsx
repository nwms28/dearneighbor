"use client";

import { useEffect, useState } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Link from "next/link";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

interface Campaign {
  id: string;
  neighborhood_name: string | null;
  address_count: number | null;
  delivery_method: string | null;
  status: string | null;
  created_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string | null }) {
  const isActive = status === "active";
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{
        backgroundColor: isActive ? "rgba(34,197,94,0.15)" : "rgba(201,168,76,0.15)",
        color: isActive ? "#4ade80" : "#c9a84c",
      }}
    >
      {status ?? "pending"}
    </span>
  );
}

interface CampaignStats {
  mailed: number;
  scanned: number;
  interested: number;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch("/api/campaigns/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.campaigns) {
          setCampaigns(data.campaigns);
          // Fire stats fetches in parallel for each campaign
          data.campaigns.forEach((c: Campaign) => {
            fetch(`/api/campaigns/stats?campaignId=${c.id}`)
              .then((r) => r.json())
              .then((s: CampaignStats) => {
                setStats((prev) => ({ ...prev, [c.id]: s }));
              })
              .catch((err) => console.error("[dashboard] stats failed for", c.id, err));
          });
        }
      })
      .catch((err) => console.error("[dashboard] failed to load campaigns:", err))
      .finally(() => setLoading(false));
  }, [user]);

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

          {loading ? (
            <p className="text-sm" style={{ color: "#64748b" }}>Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
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
          ) : (
            <div className="flex flex-col gap-4">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: "rgba(201, 168, 76, 0.06)",
                    border: "1px solid rgba(201, 168, 76, 0.2)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p
                      className="text-lg font-semibold text-white"
                      style={{ fontFamily: playfair.style.fontFamily }}
                    >
                      {c.neighborhood_name || "Unnamed campaign"}
                    </p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <p className="text-sm" style={{ color: "#94a3b8" }}>
                      <span style={{ color: "#64748b" }}>Addresses </span>
                      {c.address_count ?? "—"}
                    </p>
                    <p className="text-sm" style={{ color: "#94a3b8" }}>
                      <span style={{ color: "#64748b" }}>Delivery </span>
                      {c.delivery_method === "mail" ? "Mail for me" : c.delivery_method === "download" ? "Download PDFs" : "—"}
                    </p>
                    <p className="text-sm" style={{ color: "#94a3b8" }}>
                      <span style={{ color: "#64748b" }}>Created </span>
                      {formatDate(c.created_at)}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div
                    className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-3 border-t"
                    style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}
                  >
                    <span className="text-sm text-white">
                      📬 <span className="font-semibold">{stats[c.id]?.mailed ?? "—"}</span>{" "}
                      <span style={{ color: "#64748b" }}>mailed</span>
                    </span>
                    <span className="text-sm text-white">
                      👁 <span className="font-semibold">{stats[c.id]?.scanned ?? "—"}</span>{" "}
                      <span style={{ color: "#64748b" }}>scanned</span>
                    </span>
                    <span className="text-sm text-white">
                      ✋ <span className="font-semibold">{stats[c.id]?.interested ?? "—"}</span>{" "}
                      <span style={{ color: "#64748b" }}>interested</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
