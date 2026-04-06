"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

interface LatLng {
  lat: number;
  lng: number;
}

// Indianapolis fallback center — neighborhood-level zoom
const DEFAULT_CENTER: LatLng = { lat: 39.9042, lng: -86.1581 };
const DEFAULT_ZOOM = 13;

type DrawMode = "polygon" | "rectangle" | null;

function PlacesSearch() {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      types: ["geocode", "establishment"],
      componentRestrictions: { country: "us" },
      fields: ["geometry"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!map || !place.geometry) return;
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else if (place.geometry.location) {
        map.setCenter(place.geometry.location);
        map.setZoom(15);
      }
    });
    return () => google.maps.event.clearInstanceListeners(ac);
  }, [placesLib, map]);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for an address or area…"
        className="w-full px-4 py-2.5 rounded-lg text-sm shadow-lg outline-none"
        style={{
          backgroundColor: "#0f1f3d",
          color: "#ffffff",
          border: "1px solid rgba(201,168,76,0.4)",
        }}
      />
    </div>
  );
}

function Drawer({
  onShape,
  drawMode,
  onDrawModeChange,
}: {
  onShape: (coords: LatLng[]) => void;
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
}) {
  const map = useMap();
  const drawingLib = useMapsLibrary("drawing");
  const [manager, setManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const shapeRef = useRef<google.maps.Polygon | google.maps.Rectangle | null>(null);

  useEffect(() => {
    if (!map || !drawingLib) return;
    const dm = new drawingLib.DrawingManager({
      map,
      drawingControl: false,
      drawingControlOptions: {
        drawingModes: [
          google.maps.drawing.OverlayType.POLYGON,
          google.maps.drawing.OverlayType.RECTANGLE,
        ],
      },
      polygonOptions: {
        strokeColor: "#c9a84c",
        strokeWeight: 2,
        fillColor: "#c9a84c",
        fillOpacity: 0.15,
        editable: false,
      },
      rectangleOptions: {
        strokeColor: "#c9a84c",
        strokeWeight: 2,
        fillColor: "#c9a84c",
        fillOpacity: 0.15,
        editable: false,
      },
    });
    setManager(dm);

    const listener = google.maps.event.addListener(
      dm,
      "overlaycomplete",
      (e: google.maps.drawing.OverlayCompleteEvent) => {
        dm.setDrawingMode(null);
        if (shapeRef.current) {
          shapeRef.current.setMap(null);
          shapeRef.current = null;
        }
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
        if (coords.length > 0) onShape(coords);
        onDrawModeChange(null);
      }
    );

    return () => {
      google.maps.event.removeListener(listener);
      if (shapeRef.current) {
        shapeRef.current.setMap(null);
        shapeRef.current = null;
      }
      dm.setMap(null);
      setManager(null);
    };
  }, [map, drawingLib, onShape, onDrawModeChange]);

  // Sync external drawMode → DrawingManager. Re-runs when the manager is rebuilt.
  useEffect(() => {
    console.log("[expansion-map] drawMode changed:", drawMode, "dm:", !!manager);
    if (!manager) return;
    if (drawMode === "polygon") {
      manager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else if (drawMode === "rectangle") {
      manager.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    } else {
      manager.setDrawingMode(null);
    }
  }, [drawMode, manager]);

  return null;
}

// Geocodes a string hint and recenters the map once the geocoder is ready.
function CenterFromHint({ hint }: { hint?: string }) {
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");

  useEffect(() => {
    if (!map || !geocodingLib || !hint) return;
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: hint }, (results, status) => {
      if (status !== "OK" || !results || results.length === 0) return;
      const loc = results[0].geometry.location;
      map.setCenter({ lat: loc.lat(), lng: loc.lng() });
      map.setZoom(15);
    });
  }, [map, geocodingLib, hint]);

  return null;
}

export default function ExpansionMap({
  onShape,
  center,
  centerHint,
}: {
  onShape: (coords: LatLng[]) => void;
  center?: LatLng;
  centerHint?: string;
}) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const initialCenter = center ?? DEFAULT_CENTER;

  return (
    <div className="relative w-full h-full">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
        <Map
          defaultCenter={initialCenter}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="dearneighbor-map"
          style={{ width: "100%", height: "100%" }}
        >
          <PlacesSearch />
          <Drawer onShape={onShape} drawMode={drawMode} onDrawModeChange={setDrawMode} />
          {!center && centerHint && <CenterFromHint hint={centerHint} />}
        </Map>
      </APIProvider>

      {/* Custom drawing controls — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        <button
          type="button"
          onClick={() => setDrawMode((m) => (m === "polygon" ? null : "polygon"))}
          className="px-5 py-3 rounded-lg text-sm font-semibold transition hover:brightness-110 shadow-lg"
          style={{
            backgroundColor: "#0f1f3d",
            color: "#c9a84c",
            border: drawMode === "polygon" ? "2px solid #c9a84c" : "1px solid rgba(201,168,76,0.4)",
          }}
        >
          Draw a polygon
        </button>
        <button
          type="button"
          onClick={() => setDrawMode((m) => (m === "rectangle" ? null : "rectangle"))}
          className="px-5 py-3 rounded-lg text-sm font-semibold transition hover:brightness-110 shadow-lg"
          style={{
            backgroundColor: "#0f1f3d",
            color: "#c9a84c",
            border: drawMode === "rectangle" ? "2px solid #c9a84c" : "1px solid rgba(201,168,76,0.4)",
          }}
        >
          Draw a rectangle
        </button>
      </div>
    </div>
  );
}
