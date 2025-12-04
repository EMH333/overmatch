import { OsmElement } from "../objects";

// Function to generate the overpass query based on settings
const generateOverpassQuery = (): string => {
  // If a parameter is provided, use it; otherwise get from store
  // We need this parameter option for server-side or initial renders

  // Base query that includes all highway ways with tiger:reviewed=no
  const baseQuery = `
    (
  nwr[amenity=restaurant][name](area.hood);
  nwr[amenity=bar][name](area.hood);
  nwr[amenity=cafe][name](area.hood);
  nwr[amenity=fast_food][name](area.hood);
  nwr[amenity=pub][name](area.hood);
  );

  out ids center;
`;

  return baseQuery;
};

interface OverpassResponse {
  elements: any[];
  // Add other response properties as needed
}

export const overpassService = {
  async fetchQuery(query: string): Promise<OsmElement[]> {
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      return data.elements;
    } catch (error) {
      console.error("Error fetching from Overpass API:", error);
      throw "Error fetching from Overpass API: " + error; // Re-throw to handle in component
    }
  },
  async fetchIdsInBbox(bbox: number[]): Promise<OsmElement[]> {
    // Get current includeTracks setting
    const query =
      `
[out:json][bbox:${bbox.join(",")}];
      ` + generateOverpassQuery();
    return overpassService.fetchQuery(query.replaceAll("(area.hood)", ""));
  },
  /**
   * Fetches ways within a relation that need surface tags
   * @param relationId - OSM relation ID
   * @returns Promise<OsmWay[]> - Array of ways
   */
  async fetchIdsInRelation(relationId: string): Promise<OsmElement[]> {
    // Get current includeTracks setting
    const query =
      `
[out:json];
rel(${relationId});
map_to_area->.hood;
      ` + generateOverpassQuery();
    return overpassService.fetchQuery(query);
  },

  async fetchIds(wayIds: string[]): Promise<OsmElement[]> {
    const query = `
[out:json];
way(id:${wayIds.join(",")});
out meta geom;
      `;
    return overpassService.fetchQuery(query);
  },
};
