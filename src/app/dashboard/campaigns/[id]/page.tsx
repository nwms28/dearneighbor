"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

interface ReturnAddress {
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Campaign {
  id: string;
  campaign_name: string | null;
  neighborhood_name: string | null;
  address_count: number | null;
  delivery_method: string | null;
  status: string | null;
  created_at: string | null;
  letter: string | null;
  return_address: ReturnAddress | null;
  addresses: string[] | null;
}

interface Lead {
  id: string;
  address: string;
  status: string | null;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  timeline: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: string | null }) {
  const s = status ?? "sent";
  const color =
    s === "interested"
      ? "#4ade80"
      : s === "scanned"
      ? "#c9a84c"
      : s === "declined"
      ? "#f87171"
      : "#94a3b8";
  const bg =
    s === "interested"
      ? "rgba(74,222,128,0.12)"
      : s === "scanned"
      ? "rgba(201,168,76,0.15)"
      : s === "declined"
      ? "rgba(248,113,113,0.12)"
      : "rgba(148,163,184,0.12)";
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {s}
    </span>
  );
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCampaign(data.campaign);
        setLeads(data.leads ?? []);
      })
      .catch((err) => {
        console.error("[campaign-detail] failed to load:", err);
        setError("Could not load this campaign.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  function startEdit() {
    if (!campaign) return;
    setNameValue(campaign.campaign_name ?? campaign.neighborhood_name ?? "");
    setEditingName(true);
  }

  async function commitEdit() {
    if (!campaign) return;
    const newName = nameValue.trim();
    setEditingName(false);
    setCampaign({ ...campaign, campaign_name: newName || null });
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignName: newName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[campaign-detail] failed to rename:", err);
    }
  }

  // Build a lookup from address → lead so we can show every campaign address
  // even if no homeowner_leads row exists for it.
  const leadByAddress = new Map<string, Lead>();
  for (const l of leads) leadByAddress.set(l.address, l);
  const allAddresses: string[] = campaign?.addresses ?? [];

  const ra = campaign?.return_address ?? null;
  const returnLine = ra
    ? [
        [ra.street, ra.unit].filter(Boolean).join(", "),
        [ra.city, ra.state, ra.zip].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

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
        <Link href="/dashboard" className="text-sm" style={{ color: "#94a3b8" }}>
          ← Back to dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {loading ? (
          <p className="text-sm" style={{ color: "#64748b" }}>Loading campaign…</p>
        ) : error || !campaign ? (
          <p className="text-sm" style={{ color: "#f87171" }}>{error || "Campaign not found."}</p>
        ) : (
          <>
            {/* Header — editable name */}
            <div className="flex items-center gap-3 mb-2">
              {editingName ? (
                <input
                  type="text"
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="text-3xl md:text-4xl font-semibold text-white bg-transparent outline-none border-b flex-1 min-w-0"
                  style={{
                    fontFamily: playfair.style.fontFamily,
                    borderColor: "#c9a84c",
                  }}
                />
              ) : (
                <>
                  <h1
                    className="text-3xl md:text-4xl font-semibold text-white"
                    style={{ fontFamily: playfair.style.fontFamily }}
                  >
                    {campaign.campaign_name || campaign.neighborhood_name || "Unnamed campaign"}
                  </h1>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="text-base hover:brightness-125"
                    style={{ color: "#c9a84c" }}
                    aria-label="Rename campaign"
                    title="Rename campaign"
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 mb-10 text-sm">
              <p style={{ color: "#94a3b8" }}>
                <span style={{ color: "#64748b" }}>Neighborhood </span>
                {campaign.neighborhood_name || "—"}
              </p>
              <p style={{ color: "#94a3b8" }}>
                <span style={{ color: "#64748b" }}>Created </span>
                {formatDate(campaign.created_at)}
              </p>
              <p style={{ color: "#94a3b8" }}>
                <span style={{ color: "#64748b" }}>Delivery </span>
                {campaign.delivery_method === "mail"
                  ? "Mail for me"
                  : campaign.delivery_method === "download"
                  ? "Download PDFs"
                  : "—"}
              </p>
            </div>

            {/* Letter */}
            <section className="mb-10">
              <h2
                className="text-xs font-medium tracking-widest uppercase mb-3"
                style={{ color: "#c9a84c" }}
              >
                Letter
              </h2>
              <div
                className="rounded-xl p-6"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                }}
              >
                {campaign.letter ? (
                  <p
                    className="text-white leading-relaxed whitespace-pre-wrap"
                    style={{ fontFamily: playfair.style.fontFamily }}
                  >
                    {campaign.letter}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "#64748b" }}>No letter saved.</p>
                )}
              </div>
            </section>

            {/* Return address */}
            <section className="mb-10">
              <h2
                className="text-xs font-medium tracking-widest uppercase mb-3"
                style={{ color: "#c9a84c" }}
              >
                Return address
              </h2>
              <div
                className="rounded-xl p-5 text-sm text-white"
                style={{
                  backgroundColor: "rgba(201, 168, 76, 0.06)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                }}
              >
                {returnLine || (
                  <span style={{ color: "#64748b" }}>No return address saved.</span>
                )}
              </div>
            </section>

            {/* Addresses table */}
            <section className="mb-10">
              <h2
                className="text-xs font-medium tracking-widest uppercase mb-3"
                style={{ color: "#c9a84c" }}
              >
                Addresses ({allAddresses.length})
              </h2>
              {allAddresses.length === 0 ? (
                <p className="text-sm" style={{ color: "#64748b" }}>No addresses on this campaign.</p>
              ) : (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(201, 168, 76, 0.2)" }}
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>
                        <th
                          className="text-left px-4 py-3 text-xs font-medium tracking-wider uppercase"
                          style={{ color: "#c9a84c" }}
                        >
                          Address
                        </th>
                        <th
                          className="text-left px-4 py-3 text-xs font-medium tracking-wider uppercase"
                          style={{ color: "#c9a84c" }}
                        >
                          Status
                        </th>
                        <th
                          className="text-left px-4 py-3 text-xs font-medium tracking-wider uppercase"
                          style={{ color: "#c9a84c" }}
                        >
                          Contact
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAddresses.map((address, i) => {
                        const lead = leadByAddress.get(address);
                        const status = lead?.status ?? "sent";
                        const isInterested = status === "interested";
                        const isLast = i === allAddresses.length - 1;
                        return (
                          <tr
                            key={`${address}-${i}`}
                            style={{
                              borderBottom: isLast ? "none" : "1px solid rgba(201,168,76,0.08)",
                            }}
                          >
                            <td className="px-4 py-3 text-white">{address}</td>
                            <td className="px-4 py-3"><StatusPill status={status} /></td>
                            <td className="px-4 py-3">
                              {isInterested && (lead?.homeowner_name || lead?.homeowner_email) ? (
                                <div
                                  className="flex flex-col text-sm"
                                  style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
                                >
                                  {lead?.homeowner_name && (
                                    <span className="font-semibold">{lead.homeowner_name}</span>
                                  )}
                                  {lead?.homeowner_email && (
                                    <a
                                      href={`mailto:${lead.homeowner_email}`}
                                      className="hover:brightness-125"
                                    >
                                      {lead.homeowner_email}
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
