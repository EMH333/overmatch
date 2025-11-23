import { OsmElement } from "../objects";

/**
 * Format an OsmElement into the string format "type/id"
 * @param element - OSM element
 * @returns Formatted string like "node/123" or "way/456"
 */
export function formatOsmId(element: OsmElement): string {
  return `${element.type}/${element.id}`;
}

/**
 * Parse an OSM ID string into type and id
 * @param osmId - String like "node/123" or "way/456"
 * @returns Object with type and id
 */
export function parseOsmId(osmId: string): { type: string; id: string } {
  const [type, id] = osmId.split("/");
  return { type, id };
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns Shuffled copy of the array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get coordinates from an OSM element
 * @param element - OSM element
 * @returns Coordinates or null if not available
 */
export function getElementCoordinates(
  element: OsmElement,
): { lat: number; lon: number } | null {
  if (
    "lat" in element &&
    "lon" in element &&
    element.lat !== undefined &&
    element.lon !== undefined
  ) {
    return { lat: element.lat, lon: element.lon };
  }
  if (
    "geometry" in element &&
    "geometry" in element &&
    Array.isArray((element as any).geometry)
  ) {
    // Return center of geometry
    const coords = (element as any).geometry;
    if (coords.length > 0) {
      const centerIndex = Math.floor(coords.length / 2);
      return coords[centerIndex];
    }
  }
  if ("bounds" in element && element.bounds) {
    // Return center of bounds
    const bounds = (element as any).bounds;
    return {
      lat: (bounds.minlat + bounds.maxlat) / 2,
      lon: (bounds.minlon + bounds.maxlon) / 2,
    };
  }
  return null;
}
