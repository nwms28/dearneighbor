"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

interface CampaignStats {
  mailed: number;
  scanned: number;
  interested: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
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

function SummaryCard({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-left rounded-xl p-5 transition hover:brightness-110"
      style={{
        backgroundColor: active ? "rgba(201, 168, 76, 0.14)" : "rgba(201, 168, 76, 0.06)",
        border: active ? "2px solid #c9a84c" : "1px solid rgba(201, 168, 76, 0.2)",
      }}
    >
      <div className="text-sm mb-1" style={{ color: "#94a3b8" }}>
        <span className="mr-1">{icon}</span>
        {label}
      </div>
      <div
        className="text-3xl font-semibold"
        style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
      >
        {value}
      </div>
    </button>
  );
}

interface DashboardLead {
  id: string;
  campaign_id: string;
  campaign_name: string;
  address: string;
  status: string | null;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  timeline: string | null;
  created_at: string | null;
}

const TIMELINE_LABEL: Record<string, string> = {
  ready: "Ready soon",
  "few-months": "In a few months",
  exploring: "Just exploring",
};

type ActiveStat = "sent" | "scanned" | "interested" | "campaigns" | null;

function StatPanel({
  stat,
  campaigns,
  stats,
  leads,
  loading,
  onClose,
  onCampaignClick,
}: {
  stat: Exclude<ActiveStat, null>;
  campaigns: Campaign[];
  stats: Record<string, CampaignStats>;
  leads: DashboardLead[];
  loading: boolean;
  onClose: () => void;
  onCampaignClick: (id: string) => void;
}) {
  const title =
    stat === "sent"
      ? "Letters sent by campaign"
      : stat === "scanned"
      ? "Scanned leads"
      : stat === "interested"
      ? "Interested leads"
      : "All campaigns";

  // Group scanned leads by campaign name
  const grouped = new Map<string, DashboardLead[]>();
  if (stat === "scanned") {
    for (const l of leads) {
      const k = l.campaign_name;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(l);
    }
  }

  return (
    <section
      className="rounded-xl mb-12 overflow-hidden"
      style={{
        backgroundColor: "rgba(15, 31, 61, 0.6)",
        border: "1px solid rgba(201, 168, 76, 0.25)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          backgroundColor: "rgba(201,168,76,0.08)",
          borderBottom: "1px solid rgba(201,168,76,0.2)",
        }}
      >
        <h3
          className="text-xs font-medium tracking-widest uppercase"
          style={{ color: "#c9a84c" }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs hover:brightness-125"
          style={{ color: "#94a3b8" }}
        >
          Close ✕
        </button>
      </div>

      <div className="p-5">
        {/* SENT — list of campaigns + sent counts */}
        {stat === "sent" && (
          <div className="flex flex-col">
            {campaigns.length === 0 ? (
              <p className="text-sm" style={{ color: "#64748b" }}>No campaigns yet.</p>
            ) : (
              campaigns.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCampaignClick(c.id)}
                  className="flex items-center justify-between text-left py-2 px-2 rounded hover:bg-white/[0.03] transition"
                  style={{
                    borderBottom: i === campaigns.length - 1 ? "none" : "1px solid rgba(201,168,76,0.08)",
                  }}
                >
                  <span className="text-sm text-white truncate">
                    {c.campaign_name || c.neighborhood_name || "Unnamed campaign"}
                  </span>
                  <span className="text-sm font-semibold flex-shrink-0 ml-3" style={{ color: "#c9a84c" }}>
                    {c.address_count ?? 0} sent
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* SCANNED — grouped by campaign */}
        {stat === "scanned" &&
          (loading ? (
            <p className="text-sm" style={{ color: "#64748b" }}>Loading…</p>
          ) : leads.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748b" }}>No scanned leads yet.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {Array.from(grouped.entries()).map(([campaignName, items]) => (
                <div key={campaignName}>
                  <p
                    className="text-xs font-medium tracking-wider uppercase mb-2"
                    style={{ color: "#c9a84c" }}
                  >
                    {campaignName}
                  </p>
                  <div className="flex flex-col gap-1">
                    {items.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between text-sm py-2 px-3 rounded"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(201,168,76,0.08)",
                        }}
                      >
                        <span className="text-white truncate">{l.address}</span>
                        <span className="flex-shrink-0 ml-3" style={{ color: "#94a3b8" }}>
                          {formatDate(l.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* INTERESTED — table of homeowner contact info */}
        {stat === "interested" &&
          (loading ? (
            <p className="text-sm" style={{ color: "#64748b" }}>Loading…</p>
          ) : leads.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748b" }}>No interested leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Name", "Email", "Phone", "Address", "Campaign", "Timeline"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-xs font-medium tracking-wider uppercase"
                        style={{ color: "#c9a84c" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr
                      key={l.id}
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid rgba(201,168,76,0.08)",
                      }}
                    >
                      <td className="px-3 py-2 text-white font-medium">{l.homeowner_name ?? "—"}</td>
                      <td className="px-3 py-2">
                        {l.homeowner_email ? (
                          <a
                            href={`mailto:${l.homeowner_email}`}
                            className="hover:brightness-125"
                            style={{ color: "#c9a84c" }}
                          >
                            {l.homeowner_email}
                          </a>
                        ) : (
                          <span style={{ color: "#64748b" }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>
                        {l.homeowner_phone ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-white">{l.address}</td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>
                        {l.campaign_name}
                      </td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>
                        {l.timeline ? TIMELINE_LABEL[l.timeline] ?? l.timeline : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {/* CAMPAIGNS — full table */}
        {stat === "campaigns" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Name", "Sent", "Scanned", "Interested", "Response Rate", "Created", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-xs font-medium tracking-wider uppercase"
                      style={{ color: "#c9a84c" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => {
                  const s = stats[c.id];
                  const sent = c.address_count ?? 0;
                  const scanned = s?.scanned ?? 0;
                  const interested = s?.interested ?? 0;
                  const rate = sent > 0 ? Math.round((scanned / sent) * 100) : 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onCampaignClick(c.id)}
                      className="cursor-pointer transition hover:bg-white/[0.03]"
                      style={{
                        borderTop: i === 0 ? "none" : "1px solid rgba(201,168,76,0.08)",
                      }}
                    >
                      <td className="px-3 py-2 text-white font-medium">
                        {c.campaign_name || c.neighborhood_name || "Unnamed"}
                      </td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{sent}</td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{scanned}</td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{interested}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: rate > 0 ? "#c9a84c" : "#64748b" }}>
                        {rate}%
                      </td>
                      <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{formatDate(c.created_at)}</td>
                      <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Active summary card panel
  const [activeStat, setActiveStat] = useState<ActiveStat>(null);
  const [panelLeads, setPanelLeads] = useState<DashboardLead[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  function toggleStat(next: Exclude<ActiveStat, null>) {
    if (activeStat === next) {
      setActiveStat(null);
      return;
    }
    setActiveStat(next);
    if (next === "scanned" || next === "interested") {
      setPanelLoading(true);
      fetch(`/api/dashboard/leads?status=${next}`)
        .then((r) => r.json())
        .then((data) => setPanelLeads(data.leads ?? []))
        .catch((err) => {
          console.error("[dashboard] panel leads failed:", err);
          setPanelLeads([]);
        })
        .finally(() => setPanelLoading(false));
    }
  }

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

  useEffect(() => {
    if (!user) return;
    fetch("/api/campaigns/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.campaigns) {
          setCampaigns(data.campaigns);
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

  // Totals across all campaigns
  const totals = useMemo(() => {
    let sent = 0;
    let scanned = 0;
    let interested = 0;
    for (const c of campaigns) {
      sent += c.address_count ?? 0;
      const s = stats[c.id];
      if (s) {
        scanned += s.scanned;
        interested += s.interested;
      }
    }
    return { sent, scanned, interested, count: campaigns.length };
  }, [campaigns, stats]);

  const recentCampaigns = campaigns.slice(0, 3);

  function goToDetail(id: string) {
    router.push(`/dashboard/campaigns/${id}`);
  }

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

      <main className="max-w-5xl mx-auto px-6 py-16">
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
          className="inline-block px-8 py-4 rounded-lg font-semibold text-[#0f1f3d] text-lg transition hover:brightness-110 mb-10"
          style={{ backgroundColor: "#c9a84c" }}
        >
          + Start new campaign
        </Link>

        {/* Zone 1 — Summary stats */}
        <section className="flex flex-col sm:flex-row gap-3 mb-6">
          <SummaryCard
            icon="📬"
            label="Letters sent"
            value={totals.sent}
            active={activeStat === "sent"}
            onClick={() => toggleStat("sent")}
          />
          <SummaryCard
            icon="👁"
            label="Scanned"
            value={totals.scanned}
            active={activeStat === "scanned"}
            onClick={() => toggleStat("scanned")}
          />
          <SummaryCard
            icon="✋"
            label="Interested"
            value={totals.interested}
            active={activeStat === "interested"}
            onClick={() => toggleStat("interested")}
          />
          <SummaryCard
            icon="📋"
            label="Campaigns"
            value={totals.count}
            active={activeStat === "campaigns"}
            onClick={() => toggleStat("campaigns")}
          />
        </section>

        {activeStat && (
          <StatPanel
            stat={activeStat}
            campaigns={campaigns}
            stats={stats}
            leads={panelLeads}
            loading={panelLoading}
            onClose={() => setActiveStat(null)}
            onCampaignClick={goToDetail}
          />
        )}

        <div className="mb-12" />

        {/* Zone 2 — Recent campaigns */}
        <section className="mb-10">
          <h2
            className="text-sm font-medium tracking-widest uppercase mb-6"
            style={{ color: "#c9a84c" }}
          >
            Recent campaigns
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
              {recentCampaigns.map((c) => {
                const s = stats[c.id];
                return (
                  <div
                    key={c.id}
                    onClick={() => goToDetail(c.id)}
                    className="rounded-xl p-5 cursor-pointer transition hover:brightness-110"
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
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={() => commitEditName(c.id)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
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
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditName(c);
                            }}
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
                        {c.delivery_method === "mail"
                          ? "Mail for me"
                          : c.delivery_method === "download"
                          ? "Download PDFs"
                          : "—"}
                      </p>
                      <p className="text-sm" style={{ color: "#94a3b8" }}>
                        <span style={{ color: "#64748b" }}>Created </span>
                        {formatDate(c.created_at)}
                      </p>
                    </div>

                    <div
                      className="flex flex-wrap gap-2 mt-4 pt-3 border-t"
                      style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}
                    >
                      {([
                        { icon: "📬", label: "mailed", value: s?.mailed },
                        { icon: "👁", label: "scanned", value: s?.scanned },
                        { icon: "✋", label: "interested", value: s?.interested },
                      ]).map(({ icon, label, value }) => (
                        <span
                          key={label}
                          className="text-sm px-3 py-1.5 rounded-lg"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#ffffff",
                          }}
                        >
                          {icon} <span className="font-semibold">{value ?? "—"}</span>{" "}
                          <span style={{ color: "#64748b" }}>{label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {campaigns.length > 3 && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="self-start text-sm font-medium hover:brightness-125 mt-1"
                  style={{ color: "#c9a84c" }}
                >
                  See all campaigns →
                </button>
              )}
            </div>
          )}
        </section>

        {/* Zone 3 — All campaigns table */}
        {showAll && campaigns.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-sm font-medium tracking-widest uppercase"
                style={{ color: "#c9a84c" }}
              >
                All campaigns
              </h2>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="text-sm font-medium hover:brightness-125"
                style={{ color: "#94a3b8" }}
              >
                Hide
              </button>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(201, 168, 76, 0.2)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>
                    {["Name", "Sent", "Scanned", "Interested", "Response Rate", "Created", "Status"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium tracking-wider uppercase"
                        style={{ color: "#c9a84c" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => {
                    const s = stats[c.id];
                    const sent = c.address_count ?? 0;
                    const scanned = s?.scanned ?? 0;
                    const interested = s?.interested ?? 0;
                    const rate = sent > 0 ? Math.round((scanned / sent) * 100) : 0;
                    const isSelected = selectedRowId === c.id;
                    const isLast = i === campaigns.length - 1;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSelectedRowId(c.id);
                          goToDetail(c.id);
                        }}
                        className="cursor-pointer transition"
                        style={{
                          backgroundColor: isSelected ? "rgba(201,168,76,0.12)" : "transparent",
                          borderBottom: isLast ? "none" : "1px solid rgba(201,168,76,0.08)",
                        }}
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          {c.campaign_name || c.neighborhood_name || "Unnamed"}
                        </td>
                        <td className="px-4 py-3" style={{ color: "#94a3b8" }}>{sent}</td>
                        <td className="px-4 py-3" style={{ color: "#94a3b8" }}>{scanned}</td>
                        <td className="px-4 py-3" style={{ color: "#94a3b8" }}>{interested}</td>
                        <td
                          className="px-4 py-3 font-semibold"
                          style={{ color: rate > 0 ? "#c9a84c" : "#64748b" }}
                        >
                          {rate}%
                        </td>
                        <td className="px-4 py-3" style={{ color: "#94a3b8" }}>{formatDate(c.created_at)}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
