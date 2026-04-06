// Accepts { coordinates: { lat: number; lng: number }[], filters?: { landUseCategory?: string[] } }
// Returns  { count: number; addresses: string[]; parcels: Parcel[] }
//
// Requires REGRID_API_KEY env var (Regrid polygon search endpoint).
// Falls back to mock data if the key is not set (local dev without a key).

interface LatLng {
  lat: number;
  lng: number;
}

export type LandUseCategory =
  | "singleFamily"
  | "multiFamily"
  | "commercial"
  | "vacantLand"
  | "other";

export interface Parcel {
  parcelId: string;
  owner: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  landUse: string;
  landUseCategory: LandUseCategory;
}

// ---------------------------------------------------------------------------
// Land use classification
// ---------------------------------------------------------------------------

const SINGLE_FAMILY_PATTERNS = [
  /single.?famil/i,
  /\bsfr\b/i,
  /\bresidential\b/i,
  /\bhomestead\b/i,
  /\bdwelling\b/i,
];

const MULTI_FAMILY_PATTERNS = [
  /multi.?famil/i,
  /\bapartment/i,
  /\bcondo/i,
  /\bduplex/i,
  /\btriplex/i,
  /\bquadplex/i,
  /\bmfr\b/i,
];

const COMMERCIAL_PATTERNS = [
  /\bcommercial/i,
  /\bretail/i,
  /\boffice/i,
  /\bindustrial/i,
  /\bwarehouse/i,
];

const VACANT_PATTERNS = [
  /\bvacant/i,
  /\bunimproved/i,
  /\bempty lot/i,
];

function classifyLandUse(raw: string): LandUseCategory {
  if (SINGLE_FAMILY_PATTERNS.some((p) => p.test(raw))) return "singleFamily";
  if (MULTI_FAMILY_PATTERNS.some((p) => p.test(raw))) return "multiFamily";
  if (COMMERCIAL_PATTERNS.some((p) => p.test(raw))) return "commercial";
  if (VACANT_PATTERNS.some((p) => p.test(raw))) return "vacantLand";
  return "other";
}

// ---------------------------------------------------------------------------
// Regrid response types (abbreviated — only fields we use)
// ---------------------------------------------------------------------------

interface RegridFields {
  mail_address?: string;
  address?: string;
  owner?: string;
  mail_city?: string;
  city?: string;
  mail_state2?: string;
  state2?: string;
  mail_zip?: string;
  zip?: string;
  land_use?: string;
  usedesc?: string;
  parcelnumb?: string;
}

interface RegridFeature {
  id?: string | number;
  properties?: {
    fields?: RegridFields;
    parcelnumb?: string;
  };
}

interface RegridResponse {
  parcels?: {
    features?: RegridFeature[];
  };
  // Some responses wrap in a data key
  data?: {
    parcels?: {
      features?: RegridFeature[];
    };
  };
}

// ---------------------------------------------------------------------------
// Parse a single Regrid feature into a Parcel
// ---------------------------------------------------------------------------

function parseFeature(feature: RegridFeature): Parcel | null {
  const fields = feature.properties?.fields;
  if (!fields) return null;

  const address = (fields.mail_address ?? fields.address ?? "").trim();
  if (!address) return null;

  const city = (fields.mail_city ?? fields.city ?? "").trim();
  const state = (fields.mail_state2 ?? fields.state2 ?? "").trim();
  const zip = (fields.mail_zip ?? fields.zip ?? "").trim();
  const owner = (fields.owner ?? "").trim();
  const landUse = (fields.land_use ?? fields.usedesc ?? "").trim();
  const parcelId = String(
    feature.properties?.parcelnumb ?? fields.parcelnumb ?? feature.id ?? ""
  );

  const parts = [address, city && state ? `${city} ${state}` : city || state, zip]
    .filter(Boolean);
  const fullAddress = parts.join(", ");

  return {
    parcelId,
    owner,
    address,
    city,
    state,
    zip,
    fullAddress,
    landUse,
    landUseCategory: classifyLandUse(landUse),
  };
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

const STREETS = [
  "Oak St", "Maple Ave", "Pine Ln", "Elm Dr", "Cedar Ct",
  "Birch Rd", "Walnut St", "Ash Ave", "Cherry Ln", "Willow Dr",
  "Sycamore Ct", "Poplar Rd", "Hickory St", "Chestnut Ave", "Beech Blvd",
];

function mockParcels(centroidLat: number, centroidLng: number, count = 14): Parcel[] {
  const seed = Math.abs(Math.round(centroidLat * 1000 + centroidLng * 1000));
  return Array.from({ length: count }, (_, i) => {
    const num = ((seed * (i + 1) * 17) % 9000) + 100;
    const street = STREETS[i % STREETS.length];
    const address = `${num} ${street}`;
    return {
      parcelId: `mock-${i}`,
      owner: "Mock Owner",
      address,
      city: "Ann Arbor",
      state: "MI",
      zip: "48104",
      fullAddress: `${address}, Ann Arbor MI 48104`,
      landUse: "Single Family Residential",
      landUseCategory: "singleFamily",
    };
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const body = await request.json();
  const { coordinates, filters }: {
    coordinates: LatLng[];
    filters?: { landUseCategory?: LandUseCategory[] };
  } = body;

  if (!coordinates || coordinates.length === 0) {
    return Response.json({ error: "Missing coordinates" }, { status: 400 });
  }

  // Default filter: single family only
  const allowedCategories: LandUseCategory[] =
    filters?.landUseCategory ?? ["singleFamily"];

  const apiKey = process.env.REGRID_API_KEY;

  if (!apiKey) {
    console.log("[get-addresses] REGRID_API_KEY not set — using mock data");
    const parcels = mockParcels(
      coordinates.reduce((s, p) => s + p.lat, 0) / coordinates.length,
      coordinates.reduce((s, p) => s + p.lng, 0) / coordinates.length,
    ).filter((p) => allowedCategories.includes(p.landUseCategory));
    return Response.json({
      count: parcels.length,
      addresses: parcels.map((p) => p.fullAddress),
      parcels,
    });
  }

  // Regrid expects coordinates as [lng, lat] pairs, ring closed (first === last)
  const ring: [number, number][] = coordinates.map((p) => [p.lng, p.lat]);
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push(ring[0]);
  }

  let regridData: RegridResponse;
  try {
    const res = await fetch("https://app.regrid.com/api/v2/parcels/polygon", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        polygon: {
          type: "Polygon",
          coordinates: [ring],
        },
        limit: 100,
        fields: "standard",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[get-addresses] Regrid error:", res.status, text);
      return Response.json(
        { error: `Regrid API error: ${res.status}` },
        { status: 502 },
      );
    }

    regridData = await res.json();
  } catch (err) {
    console.error("[get-addresses] Regrid fetch failed:", err);
    return Response.json({ error: "Failed to reach Regrid API" }, { status: 502 });
  }

  const features =
    regridData?.parcels?.features ??
    regridData?.data?.parcels?.features ??
    [];

  const allParcels = features
    .map(parseFeature)
    .filter((p): p is Parcel => p !== null);

  const filtered = allParcels.filter((p) =>
    allowedCategories.includes(p.landUseCategory)
  );

  console.log(
    `[get-addresses] Regrid returned ${features.length} features → ${allParcels.length} parsed → ${filtered.length} passed land use filter (${allowedCategories.join(", ")})`
  );

  return Response.json({
    count: filtered.length,
    addresses: filtered.map((p) => p.fullAddress),
    parcels: filtered,
  });
}
