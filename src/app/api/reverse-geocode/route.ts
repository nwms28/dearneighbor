// Requires GOOGLE_MAPS_SERVER_API_KEY with Geocoding API enabled
// Can be the same key as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GeoResult {
  address_components?: AddressComponent[];
  formatted_address?: string;
  types?: string[];
}

function find(components: AddressComponent[] | undefined, ...types: string[]): AddressComponent | undefined {
  return components?.find((c) => types.some((t) => c.types.includes(t)));
}

function stateAbbr(components: AddressComponent[] | undefined): string {
  return find(components, "administrative_area_level_1")?.short_name ?? "";
}

function deriveName(results: GeoResult[]): string {
  // Pass 1: explicit neighborhood or sublocality + city + state
  for (const result of results) {
    const hood = find(result.address_components, "neighborhood", "sublocality_level_1", "sublocality_level_2");
    if (hood) {
      const city = find(result.address_components, "locality");
      const state = stateAbbr(result.address_components);
      if (city && state) return `${hood.long_name}, ${city.long_name} ${state}`;
      if (city) return `${hood.long_name}, ${city.long_name}`;
      return hood.long_name;
    }
  }

  // Pass 2: nearest route (street) + city + state → "Near Maple Rd, Ann Arbor MI"
  for (const result of results) {
    const route = find(result.address_components, "route");
    const city = find(result.address_components, "locality");
    const state = stateAbbr(result.address_components);
    if (route && city && state) return `Near ${route.long_name}, ${city.long_name} ${state}`;
    if (route && city) return `Near ${route.long_name}, ${city.long_name}`;
  }

  // Pass 3: city + state → "Ann Arbor MI"
  for (const result of results) {
    const city = find(result.address_components, "locality");
    const state = stateAbbr(result.address_components);
    if (city && state) return `${city.long_name} ${state}`;
    if (city) return city.long_name;
  }

  return "Your Selected Area";
}

export async function POST(request: Request) {
  const { lat, lng } = await request.json();

  let neighborhoodName = "Your Selected Area";

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.results?.length) {
        for (const result of data.results) {
          console.log("[reverse-geocode] address_components:", JSON.stringify(result.address_components));
        }
        neighborhoodName = deriveName(data.results);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  }

  console.log("[reverse-geocode] neighborhoodName:", neighborhoodName, "for", { lat, lng });
  return Response.json({ neighborhoodName });
}
