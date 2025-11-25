import { OsmElement, OsmNode, OsmWay, OsmRelation } from "../objects";

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
  // Handle nodes - they have lat/lon directly
  if (element.type === "node") {
    return { lat: (element as OsmNode).lat, lon: (element as OsmNode).lon };
  }

  // Handle ways - check for center property
  if (element.type === "way") {
    const way = element as OsmWay;
    if (way.center) {
      return { lat: way.center.lat, lon: way.center.lon };
    }
  }

  // Handle relations - check for center property
  if (element.type === "relation") {
    const relation = element as OsmRelation;
    if (relation.center) {
      return { lat: relation.center.lat, lon: relation.center.lon };
    }
  }

  return null;
}
