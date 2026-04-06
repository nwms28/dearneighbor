// Accepts { coordinates: { lat: number; lng: number }[] }
// Returns  { count: number; addresses: string[] }
//
// Swap the body of this handler for a real Regrid parcels-within-polygon call
// when the Regrid integration is ready — the map component needs no changes.

interface LatLng {
  lat: number;
  lng: number;
}

const STREETS = [
  "Oak St", "Maple Ave", "Pine Ln", "Elm Dr", "Cedar Ct",
  "Birch Rd", "Walnut St", "Ash Ave", "Cherry Ln", "Willow Dr",
  "Sycamore Ct", "Poplar Rd", "Hickory St", "Chestnut Ave", "Beech Blvd",
];

function mockAddresses(centroidLat: number, centroidLng: number, count = 14): string[] {
  const seed = Math.abs(Math.round(centroidLat * 1000 + centroidLng * 1000));
  return Array.from({ length: count }, (_, i) => {
    const num = ((seed * (i + 1) * 17) % 9000) + 100;
    return `${num} ${STREETS[i % STREETS.length]}`;
  });
}

export async function POST(request: Request) {
  const { coordinates }: { coordinates: LatLng[] } = await request.json();

  if (!coordinates || coordinates.length === 0) {
    return Response.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const centroidLat = coordinates.reduce((s, p) => s + p.lat, 0) / coordinates.length;
  const centroidLng = coordinates.reduce((s, p) => s + p.lng, 0) / coordinates.length;

  const addresses = mockAddresses(centroidLat, centroidLng);

  return Response.json({ count: addresses.length, addresses });
}
