"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Playfair_Display, DM_Sans } from "next/font/google";
import ExpansionMap from "@/components/expansion-map";

const REACH_GOAL = 75;

interface ManualField {
  street: string;
  city: string;
  state: string;
  zip: string;
}
const EMPTY_MANUAL: ManualField = { street: "", city: "", state: "", zip: "" };

interface LatLng {
  lat: number;
  lng: number;
}

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Expansion overlay state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [tab, setTab] = useState<"map" | "manual">("map");
  const [pendingNew, setPendingNew] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [manual, setManual] = useState<ManualField>(EMPTY_MANUAL);
  const [manualError, setManualError] = useState("");
  const [findingAddresses, setFindingAddresses] = useState(false);
  const [expandPaying, setExpandPaying] = useState(false);

  // Post-payment expansion banner
  const [expansionBanner, setExpansionBanner] = useState<string>("");

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleDownload() {
    if (!campaign) return;
    setDownloadState("loading");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setDownloadState("done");
    } catch (err) {
      console.error("[campaign-detail] download failed:", err);
      setDownloadState("error");
    }
  }

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

  // Handle post-Stripe expansion redirect
  useEffect(() => {
    const expanded = searchParams.get("expanded");
    const sessionId = searchParams.get("session_id");
    if (expanded !== "true" || !sessionId) return;

    const storageKey = `expansion_${id}`;
    const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (!raw) {
      setExpansionBanner("🎉 Your campaign has been expanded.");
      return;
    }
    let newAddresses: string[] = [];
    try {
      newAddresses = JSON.parse(raw);
    } catch {
      console.error("[campaign-detail] could not parse expansion payload");
      return;
    }
    if (!Array.isArray(newAddresses) || newAddresses.length === 0) return;

    fetch(`/api/campaigns/${id}/expand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newAddresses, sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        setExpansionBanner(`🎉 ${data.newCount} new letters sent! Your campaign has been expanded.`);
        localStorage.removeItem(storageKey);
        // Refresh the campaign data to pick up new addresses/leads
        return fetch(`/api/campaigns/${id}`).then((r) => r.json());
      })
      .then((data) => {
        if (data?.campaign) {
          setCampaign(data.campaign);
          setLeads(data.leads ?? []);
        }
        // Clean the URL so a refresh doesn't re-trigger
        router.replace(`/dashboard/campaigns/${id}`);
      })
      .catch((err) => {
        console.error("[campaign-detail] expand failed:", err);
        setExpansionBanner("Something went wrong applying your expansion. Please contact support.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Existing addresses for dedupe
  const existingAddressSet = new Set(campaign?.addresses ?? []);

  async function handleMapShape(coords: LatLng[]) {
    setFindingAddresses(true);
    try {
      const res = await fetch("/api/get-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: coords }),
      });
      const data = await res.json();
      const fetched: string[] = data.addresses ?? [];
      const dedupedNew: string[] = [];
      let dupes = 0;
      for (const a of fetched) {
        if (existingAddressSet.has(a) || pendingNew.includes(a)) {
          dupes++;
          continue;
        }
        dedupedNew.push(a);
      }
      setPendingNew((prev) => Array.from(new Set([...prev, ...dedupedNew])));
      setDuplicateCount((n) => n + dupes);
    } catch (err) {
      console.error("[campaign-detail] get-addresses failed:", err);
    } finally {
      setFindingAddresses(false);
    }
  }

  function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError("");
    if (!manual.street || !manual.city || !manual.state || !manual.zip) {
      setManualError("All fields are required.");
      return;
    }
    const formatted = `${manual.street}, ${manual.city} ${manual.state} ${manual.zip}`;
    if (existingAddressSet.has(formatted) || pendingNew.includes(formatted)) {
      setDuplicateCount((n) => n + 1);
      setManual(EMPTY_MANUAL);
      return;
    }
    setPendingNew((prev) => Array.from(new Set([...prev, formatted])));
    setManual(EMPTY_MANUAL);
  }

  function removePending(addr: string) {
    setPendingNew((prev) => prev.filter((a) => a !== addr));
  }

  function closeOverlay() {
    setOverlayOpen(false);
    setPendingNew([]);
    setDuplicateCount(0);
    setManual(EMPTY_MANUAL);
    setManualError("");
    setTab("map");
  }

  async function handleConfirmExpansion() {
    if (!campaign || pendingNew.length === 0) return;
    setExpandPaying(true);
    try {
      // Stash the new addresses so the post-payment effect can read them
      localStorage.setItem(`expansion_${campaign.id}`, JSON.stringify(pendingNew));
      const res = await fetch("/api/create-expansion-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, newAddressCount: pendingNew.length }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("[campaign-detail] expansion checkout failed:", err);
      setExpandPaying(false);
    }
  }

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

            {/* Download button (download delivery only) */}
            {campaign.delivery_method === "download" && (
              <div className="mb-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloadState === "loading"}
                  className="self-start px-5 py-2.5 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: "#c9a84c" }}
                >
                  {downloadState === "loading"
                    ? "Sending to the printer…"
                    : downloadState === "done"
                    ? "Email sent — check your inbox"
                    : "Email me my PDFs"}
                </button>
                {downloadState === "done" && (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>
                    Your PDFs are being prepared. You&apos;ll receive an email with the download link shortly.
                  </p>
                )}
                {downloadState === "error" && (
                  <p className="text-sm" style={{ color: "#f87171" }}>
                    Something went wrong queueing your PDFs. Please try again.
                  </p>
                )}
              </div>
            )}

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

            {/* Reach progress + expand CTA */}
            {(() => {
              const reached = campaign.address_count ?? campaign.addresses?.length ?? 0;
              const pct = Math.min(100, Math.round((reached / REACH_GOAL) * 100));
              return (
                <section className="mb-10">
                  {expansionBanner && (
                    <div
                      className="rounded-xl p-4 mb-5 text-sm font-medium"
                      style={{
                        backgroundColor: "rgba(201,168,76,0.14)",
                        border: "2px solid #c9a84c",
                        color: "#c9a84c",
                      }}
                    >
                      {expansionBanner}
                    </div>
                  )}
                  <div
                    className="rounded-xl p-5"
                    style={{
                      backgroundColor: "rgba(201, 168, 76, 0.06)",
                      border: "1px solid rgba(201, 168, 76, 0.2)",
                    }}
                  >
                    <p className="text-lg text-white font-semibold mb-1">
                      🏠 {reached} homeowner{reached !== 1 ? "s" : ""} reached
                    </p>
                    <p className="text-xs mb-3" style={{ color: "#c9a84c" }}>
                      Most buyers find their home after reaching 50–75 homeowners in their target area.
                    </p>
                    <div
                      className="w-full h-2 rounded-full overflow-hidden mb-4"
                      style={{ backgroundColor: "rgba(15,31,61,0.8)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: "#c9a84c" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOverlayOpen(true)}
                      className="px-5 py-2.5 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110"
                      style={{ backgroundColor: "#c9a84c" }}
                    >
                      Reach more homeowners →
                    </button>
                  </div>
                </section>
              );
            })()}

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

      {/* Expansion overlay */}
      {overlayOpen && campaign && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: "rgba(15, 31, 61, 0.96)" }}
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
              Reach more homeowners
            </span>
            <button
              type="button"
              onClick={closeOverlay}
              className="text-sm hover:brightness-125"
              style={{ color: "#94a3b8" }}
            >
              Cancel ✕
            </button>
          </header>

          {/* Tabs */}
          <div
            className="flex flex-shrink-0 border-b"
            style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
          >
            {(["map", "manual"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="px-6 py-3 text-sm font-medium transition"
                style={{
                  color: tab === t ? "#c9a84c" : "#94a3b8",
                  borderBottom: tab === t ? "2px solid #c9a84c" : "2px solid transparent",
                }}
              >
                {t === "map" ? "Draw on map" : "Add by address"}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-h-0 relative">
              {tab === "map" ? (
                <ExpansionMap
                  onShape={handleMapShape}
                  centerHint={
                    campaign.addresses?.[0] ?? campaign.neighborhood_name ?? undefined
                  }
                />
              ) : (
                <div className="p-8 max-w-md mx-auto w-full">
                  <p
                    className="text-xs font-medium tracking-widest uppercase mb-3"
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
                      className="w-full px-4 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c]"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="City"
                        value={manual.city}
                        onChange={(e) => setManual((p) => ({ ...p, city: e.target.value }))}
                        className="px-4 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c]"
                      />
                      <input
                        type="text"
                        placeholder="ST"
                        maxLength={2}
                        value={manual.state}
                        onChange={(e) => setManual((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                        className="px-4 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c]"
                      />
                      <input
                        type="text"
                        placeholder="Zip"
                        maxLength={5}
                        value={manual.zip}
                        onChange={(e) => setManual((p) => ({ ...p, zip: e.target.value.replace(/\D/g, "") }))}
                        className="px-4 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c]"
                      />
                    </div>
                    {manualError && (
                      <p className="text-xs" style={{ color: "#f87171" }}>{manualError}</p>
                    )}
                    <button
                      type="submit"
                      className="self-start px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0f1f3d] transition hover:brightness-110"
                      style={{ backgroundColor: "#c9a84c" }}
                    >
                      Add address
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right rail — pending list */}
            <aside
              className="w-80 flex-shrink-0 flex flex-col border-l overflow-y-auto"
              style={{ borderColor: "rgba(201, 168, 76, 0.2)", backgroundColor: "#0f1f3d" }}
            >
              <div className="p-5 flex flex-col gap-2">
                <p className="text-sm text-white">
                  <span className="font-semibold" style={{ color: "#c9a84c" }}>
                    {pendingNew.length}
                  </span>{" "}
                  new homeowner{pendingNew.length !== 1 ? "s" : ""} found
                  {duplicateCount > 0 && (
                    <>
                      {" — "}
                      <span style={{ color: "#94a3b8" }}>
                        {duplicateCount} already in your campaign
                      </span>
                    </>
                  )}
                </p>
                {findingAddresses && (
                  <p className="text-xs" style={{ color: "#94a3b8" }}>Looking up addresses…</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1">
                {pendingNew.map((a, idx) => (
                  <div
                    key={`${a}-${idx}`}
                    className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded"
                    style={{
                      backgroundColor: "rgba(201,168,76,0.05)",
                      border: "1px solid rgba(201,168,76,0.12)",
                    }}
                  >
                    <span className="text-white truncate">{a}</span>
                    <button
                      type="button"
                      onClick={() => removePending(a)}
                      className="flex-shrink-0 hover:brightness-125"
                      style={{ color: "#94a3b8" }}
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="p-5 border-t flex flex-col gap-2"
                style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
              >
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  ${(pendingNew.length * 2.99).toFixed(2)} mailing cost
                </p>
                <button
                  type="button"
                  onClick={handleConfirmExpansion}
                  disabled={pendingNew.length === 0 || expandPaying}
                  className="w-full py-3 rounded-lg font-semibold text-[#0f1f3d] transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#c9a84c" }}
                >
                  {expandPaying
                    ? "Redirecting…"
                    : `Add ${pendingNew.length} homeowner${pendingNew.length !== 1 ? "s" : ""} →`}
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
