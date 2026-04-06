"use client";

import { useState, useRef, useEffect } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Link from "next/link";
import { useCampaignStore, type LatLng } from "@/hooks/useCampaignStore";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

const US_CENTER = { lat: 39.5, lng: -98.35 };
const US_ZOOM = 4;

// ---------------------------------------------------------------------------
// PlacesSearch
// ---------------------------------------------------------------------------
function PlacesSearch() {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      types: ["geocode", "establishment"],
      componentRestrictions: { country: "us" },
      fields: ["geometry", "name", "types"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!map || !place.geometry) return;
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else if (place.geometry.location) {
        const isDetailed = place.types?.some((t) =>
          ["neighborhood", "sublocality", "premise", "street_address", "route"].includes(t),
        ) ?? false;
        map.setCenter(place.geometry.location);
        map.setZoom(isDetailed ? 15 : 13);
      }
    });

    return () => google.maps.event.clearInstanceListeners(ac);
  }, [placesLib, map]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for a neighborhood, city, or address..."
        className="w-full px-4 py-3 rounded-lg text-sm shadow-lg outline-none transition"
        style={{
          backgroundColor: "#0f1f3d",
          color: "#ffffff",
          border: "1px solid rgba(201,168,76,0.4)",
          fontFamily: dmSans.style.fontFamily,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DrawingLayer
// ---------------------------------------------------------------------------
interface DrawingLayerProps {
  onShapeComplete: (centroid: LatLng, coordinates: LatLng[]) => void;
  onClear: () => void;
  triggerClear: number;
}

function DrawingLayer({ onShapeComplete, onClear, triggerClear }: DrawingLayerProps) {
  const map = useMap();
  const drawingLib = useMapsLibrary("drawing");
  const managerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const shapeRef = useRef<google.maps.Polygon | google.maps.Rectangle | null>(null);

  useEffect(() => {
    if (!map || !drawingLib) return;
    const dm = new drawingLib.DrawingManager({
      map,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.POLYGON,
          google.maps.drawing.OverlayType.RECTANGLE,
        ],
      },
      polygonOptions: {
        strokeColor: "#c9a84c", strokeWeight: 2,
        fillColor: "#c9a84c", fillOpacity: 0.15, editable: false,
      },
      rectangleOptions: {
        strokeColor: "#c9a84c", strokeWeight: 2,
        fillColor: "#c9a84c", fillOpacity: 0.15, editable: false,
      },
    });
    managerRef.current = dm;

    google.maps.event.addListener(dm, "overlaycomplete", (e: google.maps.drawing.OverlayCompleteEvent) => {
      dm.setDrawingMode(null);
      shapeRef.current = e.overlay as google.maps.Polygon | google.maps.Rectangle;

      let coords: LatLng[] = [];
      if (e.type === google.maps.drawing.OverlayType.POLYGON) {
        coords = (e.overlay as google.maps.Polygon)
          .getPath()
          .getArray()
          .map((p) => ({ lat: p.lat(), lng: p.lng() }));
      } else {
        const bounds = (e.overlay as google.maps.Rectangle).getBounds();
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          coords = [
            { lat: ne.lat(), lng: ne.lng() },
            { lat: ne.lat(), lng: sw.lng() },
            { lat: sw.lat(), lng: sw.lng() },
            { lat: sw.lat(), lng: ne.lng() },
          ];
        }
      }

      if (coords.length === 0) return;
      const centroid: LatLng = {
        lat: coords.reduce((s, p) => s + p.lat, 0) / coords.length,
        lng: coords.reduce((s, p) => s + p.lng, 0) / coords.length,
      };
      onShapeComplete(centroid, coords);
    });

    return () => {
      google.maps.event.clearInstanceListeners(dm);
      dm.setMap(null);
      managerRef.current = null;
    };
  }, [map, drawingLib, onShapeComplete]);

  function clearAll() {
    shapeRef.current?.setMap(null);
    shapeRef.current = null;
    managerRef.current?.setDrawingMode(null);
    onClear();
  }

  useEffect(() => {
    if (triggerClear === 0) return;
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerClear]);

  return null;
}

// ---------------------------------------------------------------------------
// SidePanel
// ---------------------------------------------------------------------------
interface SidePanelProps {
  estimatedCount: number;
  onRedraw: () => void;
  loading: boolean;
  campaignName: string;
  onCampaignNameChange: (value: string) => void;
}

function SidePanel({ estimatedCount, onRedraw, loading, campaignName, onCampaignNameChange }: SidePanelProps) {
  return (
    <aside
      className="w-80 flex-shrink-0 flex flex-col gap-6 p-6 border-l overflow-y-auto"
      style={{ backgroundColor: "#0f1f3d", borderColor: "rgba(201, 168, 76, 0.2)" }}
    >
      <div>
        <label
          className="block text-xs font-medium tracking-widest uppercase mb-2"
          style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}
        >
          Campaign name <span className="normal-case tracking-normal" style={{ color: "#64748b" }}>(optional)</span>
        </label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          placeholder="e.g. Burns Park, Barton Hills, My Dream Neighborhood"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none transition"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "#ffffff",
            border: "1px solid rgba(201,168,76,0.3)",
            fontFamily: dmSans.style.fontFamily,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#c9a84c")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)")}
        />
      </div>

      <div>
        <p className="text-xs font-medium tracking-widest uppercase mb-1"
          style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}>
          Area selected
        </p>
        <p className="text-white text-sm" style={{ fontFamily: dmSans.style.fontFamily }}>
          Your neighborhood boundary has been drawn.
        </p>
      </div>

      <div className="rounded-lg p-4"
        style={{ backgroundColor: "rgba(201, 168, 76, 0.08)", border: "1px solid rgba(201, 168, 76, 0.2)" }}>
        <p className="text-xs font-medium tracking-widest uppercase mb-2"
          style={{ color: "#c9a84c", fontFamily: dmSans.style.fontFamily }}>
          Homes in selection
        </p>
        {loading ? (
          <p className="text-sm" style={{ color: "#94a3b8" }}>Counting homes…</p>
        ) : (
          <>
            <p className="text-3xl font-semibold text-white"
              style={{ fontFamily: playfair.style.fontFamily }}>
              ~{estimatedCount}
            </p>
            <p className="text-sm mt-1" style={{ color: "#64748b", fontFamily: dmSans.style.fontFamily }}>
              homes in your selection
            </p>
          </>
        )}
      </div>

      <Link
        href="/dashboard/new-campaign/letter"
        className="w-full px-5 py-3 rounded-lg font-semibold text-[#0f1f3d] text-center transition hover:brightness-110"
        style={{ backgroundColor: loading ? "rgba(201,168,76,0.4)" : "#c9a84c", fontFamily: dmSans.style.fontFamily }}
        aria-disabled={loading}
        onClick={(e) => loading && e.preventDefault()}
      >
        Next: Write your letter →
      </Link>

      <button
        onClick={onRedraw}
        className="w-full px-5 py-2.5 rounded-lg text-sm font-medium transition hover:brightness-110"
        style={{
          color: "#c9a84c", border: "1px solid rgba(201,168,76,0.4)",
          backgroundColor: "transparent", fontFamily: dmSans.style.fontFamily,
        }}
      >
        ↺ Redraw area
      </button>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function NewCampaignPage() {
  const store = useCampaignStore();
  const [polygonDrawn, setPolygonDrawn] = useState(false);
  const [clearTrigger, setClearTrigger] = useState(0);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  async function handleShapeComplete(centroid: LatLng, coordinates: LatLng[]) {
    setPolygonDrawn(true);
    store.setCoordinates(coordinates);
    setGeocodeLoading(true);
    try {
      const [addressesRes, geocodeRes] = await Promise.all([
        fetch("/api/get-addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates }),
        }),
        fetch("/api/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: centroid.lat, lng: centroid.lng }),
        }),
      ]);

      const [addressesData, geocodeData] = await Promise.all([
        addressesRes.json(),
        geocodeRes.json(),
      ]);

      store.setEstimatedCount(addressesData.count ?? 0);
      store.setAddresses(addressesData.addresses ?? []);
      const neighborhoodName = geocodeData.neighborhoodName ?? "Selected Neighborhood";
      console.log("[map] reverse-geocode result:", neighborhoodName);
      store.setNeighborhoodName(neighborhoodName);
    } catch {
      store.setEstimatedCount(0);
      store.setAddresses([]);
      store.setNeighborhoodName("Selected Neighborhood");
    } finally {
      setGeocodeLoading(false);
    }
  }

  function handleClear() {
    setPolygonDrawn(false);
    store.setCoordinates([]);
    store.setNeighborhoodName("");
    store.setEstimatedCount(0);
    store.setAddresses([]);
  }

  function handleRedraw() {
    setClearTrigger((n) => n + 1);
    handleClear();
  }

  return (
    <div className="flex flex-col h-screen"
      style={{ backgroundColor: "#0f1f3d", fontFamily: dmSans.style.fontFamily }}>
      <header
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}>
        <span className="text-xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}>
          Dear · Neighbor
        </span>
        <span className="text-sm" style={{ color: "#94a3b8" }}>
          Step 1 of 5 — Select your neighborhood
        </span>
        <Link href="/dashboard" className="text-sm" style={{ color: "#64748b" }}>
          ← Back to dashboard
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="relative flex-1">
          {polygonDrawn && (
            <button
              onClick={handleRedraw}
              className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-lg text-xs font-medium shadow transition hover:brightness-110"
              style={{
                backgroundColor: "#0f1f3d", color: "#c9a84c",
                border: "1px solid rgba(201,168,76,0.4)", fontFamily: dmSans.style.fontFamily,
              }}>
              Clear
            </button>
          )}

          {/* Note: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY needs Maps JS API, Places API, and Drawing library enabled */}
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <Map
              defaultCenter={US_CENTER}
              defaultZoom={US_ZOOM}
              gestureHandling="greedy"
              disableDefaultUI={false}
              mapId="dearneighbor-map"
              style={{ width: "100%", height: "100%" }}
            >
              <PlacesSearch />
              <DrawingLayer
                onShapeComplete={handleShapeComplete}
                onClear={handleClear}
                triggerClear={clearTrigger}
              />
            </Map>
          </APIProvider>
        </div>

        {polygonDrawn && (
          <SidePanel
            estimatedCount={store.estimatedCount}
            onRedraw={handleRedraw}
            loading={geocodeLoading}
            campaignName={store.campaignName}
            onCampaignNameChange={store.setCampaignName}
          />
        )}
      </div>
    </div>
  );
}
