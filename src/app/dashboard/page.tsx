"use client";

import { useEffect, useState } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Link from "next/link";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

interface Campaign {
  id: string;
  campaign_name: string | null;
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

type LeadFilter = "all" | "scanned" | "interested";

interface Lead {
  id: string;
  address: string;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  timeline: string | null;
  status: string | null;
}

const TIMELINE_LABEL: Record<string, string> = {
  ready: "Ready soon",
  "few-months": "In a few months",
  exploring: "Just exploring",
};

export default function DashboardPage() {
  const { user } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);

  // Currently expanded panel: { campaignId, filter } — null when nothing expanded
  const [expanded, setExpanded] = useState<{ campaignId: string; filter: LeadFilter } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Inline name editing
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  function startEditName(c: Campaign) {
    setEditingNameId(c.id);
    setEditingNameValue(c.campaign_name ?? c.neighborhood_name ?? "");
  }

  async function commitEditName(id: string) {
    const newName = editingNameValue.trim();
    setEditingNameId(null);
    // Optimistic update
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, campaign_name: newName || null } : c))
    );
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignName: newName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[dashboard] failed to rename campaign:", err);
    }
  }

  function handleStatClick(campaignId: string, filter: LeadFilter) {
    // Same stat clicked again → collapse
    if (expanded && expanded.campaignId === campaignId && expanded.filter === filter) {
      setExpanded(null);
      setLeads([]);
      return;
    }
    setExpanded({ campaignId, filter });
    setLeadsLoading(true);
    fetch(`/api/campaigns/leads?campaignId=${campaignId}&status=${filter}`)
      .then((r) => r.json())
      .then((data) => setLeads(data.leads ?? []))
      .catch((err) => {
        console.error("[dashboard] leads fetch failed:", err);
        setLeads([]);
      })
      .finally(() => setLeadsLoading(false));
  }

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
                    {editingNameId === c.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onBlur={() => commitEditName(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditName(c.id);
                          if (e.key === "Escape") setEditingNameId(null);
                        }}
                        className="text-lg font-semibold text-white bg-transparent outline-none border-b flex-1 min-w-0"
                        style={{
                          fontFamily: playfair.style.fontFamily,
                          borderColor: "#c9a84c",
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p
                          className="text-lg font-semibold text-white truncate"
                          style={{ fontFamily: playfair.style.fontFamily }}
                        >
                          {c.campaign_name || c.neighborhood_name || "Unnamed campaign"}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditName(c)}
                          className="text-sm flex-shrink-0 hover:brightness-125"
                          style={{ color: "#c9a84c" }}
                          aria-label="Rename campaign"
                          title="Rename campaign"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
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

                  {/* Stats row — clickable */}
                  <div
                    className="flex flex-wrap gap-2 mt-4 pt-3 border-t"
                    style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}
                  >
                    {([
                      { filter: "all" as const, icon: "📬", label: "mailed", value: stats[c.id]?.mailed },
                      { filter: "scanned" as const, icon: "👁", label: "scanned", value: stats[c.id]?.scanned },
                      { filter: "interested" as const, icon: "✋", label: "interested", value: stats[c.id]?.interested },
                    ]).map(({ filter, icon, label, value }) => {
                      const isActive = expanded?.campaignId === c.id && expanded.filter === filter;
                      return (
                        <button
                          key={filter}
                          onClick={() => handleStatClick(c.id, filter)}
                          className="text-sm px-3 py-1.5 rounded-lg transition hover:brightness-125"
                          style={{
                            backgroundColor: isActive ? "rgba(201, 168, 76, 0.18)" : "rgba(255,255,255,0.03)",
                            border: isActive ? "1px solid #c9a84c" : "1px solid rgba(255,255,255,0.08)",
                            color: isActive ? "#c9a84c" : "#ffffff",
                          }}
                        >
                          {icon} <span className="font-semibold">{value ?? "—"}</span>{" "}
                          <span style={{ color: isActive ? "#c9a84c" : "#64748b" }}>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Expandable leads panel */}
                  {expanded?.campaignId === c.id && (
                    <div
                      className="mt-4 pt-4 border-t"
                      style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}
                    >
                      {leadsLoading ? (
                        <p className="text-sm" style={{ color: "#64748b" }}>Loading leads…</p>
                      ) : leads.length === 0 ? (
                        <p className="text-sm" style={{ color: "#64748b" }}>
                          No {expanded.filter === "all" ? "" : expanded.filter} leads yet.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {leads.map((l) => (
                            <div
                              key={l.id}
                              className="rounded-lg p-3 flex flex-col gap-1"
                              style={{
                                backgroundColor: "rgba(15, 31, 61, 0.6)",
                                border: "1px solid rgba(201, 168, 76, 0.1)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-sm text-white font-medium">{l.address}</span>
                                <StatusBadge status={l.status} />
                              </div>
                              {(l.homeowner_name || l.homeowner_email || l.timeline) && (
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: "#94a3b8" }}>
                                  {l.homeowner_name && <span>{l.homeowner_name}</span>}
                                  {l.homeowner_email && (
                                    <a href={`mailto:${l.homeowner_email}`} style={{ color: "#c9a84c" }}>
                                      {l.homeowner_email}
                                    </a>
                                  )}
                                  {l.homeowner_phone && <span>{l.homeowner_phone}</span>}
                                  {l.timeline && (
                                    <span>{TIMELINE_LABEL[l.timeline] ?? l.timeline}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
