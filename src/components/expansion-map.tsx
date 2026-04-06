"use client";

import { useEffect, useRef } from "react";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

interface LatLng {
  lat: number;
  lng: number;
}

const US_CENTER = { lat: 39.5, lng: -98.35 };

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

function Drawer({ onShape }: { onShape: (coords: LatLng[]) => void }) {
  const map = useMap();
  const drawingLib = useMapsLibrary("drawing");
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
      }
    );

    return () => {
      google.maps.event.removeListener(listener);
      if (shapeRef.current) {
        shapeRef.current.setMap(null);
        shapeRef.current = null;
      }
      dm.setMap(null);
    };
  }, [map, drawingLib, onShape]);

  return null;
}

export default function ExpansionMap({ onShape }: { onShape: (coords: LatLng[]) => void }) {
  return (
    <div className="relative w-full h-full">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
        <Map
          defaultCenter={US_CENTER}
          defaultZoom={4}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="dearneighbor-map"
          style={{ width: "100%", height: "100%" }}
        >
          <PlacesSearch />
          <Drawer onShape={onShape} />
        </Map>
      </APIProvider>
    </div>
  );
}
