"use client";

import { useState, useCallback } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Link from "next/link";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

const ANN_ARBOR = { lat: 42.2808, lng: -83.743 };

function DrawingLayer({ onPolygonComplete }: { onPolygonComplete: () => void }) {
  const map = useMap();
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<google.maps.LatLng[]>([]);
  const [polygon, setPolygon] = useState<google.maps.Polygon | null>(null);
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  const startDrawing = useCallback(() => {
    if (!map) return;
    if (polygon) {
      polygon.setMap(null);
      setPolygon(null);
    }
    if (polyline) {
      polyline.setMap(null);
      setPolyline(null);
    }
    setPoints([]);
    setDrawing(true);
    map.setOptions({ draggableCursor: "crosshair" });

    const pl = new google.maps.Polyline({
      map,
      strokeColor: "#c9a84c",
      strokeWeight: 2,
      strokeOpacity: 0.8,
    });
    setPolyline(pl);

    const clickListener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      setPoints((prev) => {
        const next = [...prev, e.latLng!];
        pl.setPath(next);
        return next;
      });
    });

    const dblClickListener = map.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
      e.stop?.();
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(dblClickListener);

      setPoints((prev) => {
        if (prev.length < 3) return prev;
        pl.setMap(null);
        const poly = new google.maps.Polygon({
          map,
          paths: prev,
          strokeColor: "#c9a84c",
          strokeWeight: 2,
          fillColor: "#c9a84c",
          fillOpacity: 0.15,
        });
        setPolygon(poly);
        return prev;
      });

      map.setOptions({ draggableCursor: "" });
      setDrawing(false);
      onPolygonComplete();
    });
  }, [map, polygon, polyline, onPolygonComplete]);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <button
        onClick={startDrawing}
        disabled={drawing}
        className="px-5 py-3 rounded-lg font-semibold text-[#0f1f3d] shadow-lg transition hover:brightness-110 disabled:opacity-50"
        style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
      >
        {drawing ? "Click to draw · Double-click to finish" : "Draw neighborhood boundary"}
      </button>
    </div>
  );
}

function SidePanel() {
  return (
    <aside
      className="w-80 flex-shrink-0 flex flex-col gap-6 p-6 border-l"
      style={{
        backgroundColor: "#0f1f3d",
        borderColor: "rgba(201, 168, 76, 0.2)",
      }}
    >
      <div>
        <p
          className="text-xs font-medium tracking-widest uppercase mb-1"
          style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
        >
          Area selected
        </p>
        <p className="text-white text-sm" style={{ fontFamily: dmSans.style.fontFamily }}>
          Your neighborhood boundary has been drawn.
        </p>
      </div>

      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "rgba(201, 168, 76, 0.08)",
          border: "1px solid rgba(201, 168, 76, 0.2)",
        }}
      >
        <p
          className="text-xs font-medium tracking-widest uppercase mb-2"
          style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
        >
          Addresses found
        </p>
        <p className="text-3xl font-semibold text-white" style={{ fontFamily: playfair.style.fontFamily }}>
          14
        </p>
        <p className="text-sm mt-1" style={{ color: "#64748b", fontFamily: dmSans.style.fontFamily }}>
          residential addresses in this area
        </p>
      </div>

      <Link
        href="/dashboard/new-campaign/letter"
        className="w-full px-5 py-3 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110"
        style={{ backgroundColor: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
      >
        Next: Write your letter →
      </Link>
    </aside>
  );
}

export default function NewCampaignPage() {
  const [polygonDrawn, setPolygonDrawn] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
          Step 1 of 4 — Select your neighborhood
        </span>
        <Link href="/dashboard" className="text-sm" style={{ color: "#64748b" }}>
          ← Back to dashboard
        </Link>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="relative flex-1">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={ANN_ARBOR}
              defaultZoom={14}
              gestureHandling="greedy"
              disableDefaultUI={false}
              mapId="dearneighbor-map"
              style={{ width: "100%", height: "100%" }}
            >
              <DrawingLayer onPolygonComplete={() => setPolygonDrawn(true)} />
            </Map>
          </APIProvider>
        </div>

        {/* Side panel — shown after polygon is drawn */}
        {polygonDrawn && <SidePanel />}
      </div>
    </div>
  );
}
