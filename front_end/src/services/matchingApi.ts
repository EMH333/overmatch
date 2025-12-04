import { MatchesResponse, ElementsResponse } from "../types/matching";

const API_BASE_URL = "https://xju8rrh0b3.execute-api.us-east-1.amazonaws.com"; // TODO: Move to env variable

export const matchingApi = {
  /**
   * Check if OSM elements have matches with Overture elements
   * @param osmIds - Array of OSM element IDs in format "type/id" (e.g., ["way/123", "node/456"])
   * @returns Promise<MatchesResponse>
   */
  async getMatches(osmIds: string[]): Promise<MatchesResponse> {
    if (osmIds.length === 0) {
      return { elements: [] };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/matches/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: osmIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: MatchesResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching matches:", error);
      throw "Error fetching matches: " + error;
    }
  },

  /**
   * Check if OSM elements exist in the database
   * @param osmIds - Array of OSM element IDs in format "type/id" (e.g., ["way/123", "node/456"])
   * @returns Promise<ElementsResponse>
   */
  async getOsmElements(osmIds: string[]): Promise<ElementsResponse> {
    if (osmIds.length === 0) {
      return { elements: [] };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/osm/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: osmIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ElementsResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching OSM elements:", error);
      throw "Error fetching OSM elements: " + error;
    }
  },

  /**
   * Mark OSM elements as seen/processed
   * @param osmIds - Array of OSM element IDs in format "type/id"
   * @returns Promise with success status
   */
  async postOsmElements(osmIds: string[]): Promise<{
    success: boolean;
    count: number;
    timestamp: string;
  }> {
    try {
      const payload = { ids: osmIds };
      console.log("Sending to /osm endpoint:", payload);

      const response = await fetch(`${API_BASE_URL}/osm/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error posting OSM elements:", error);
      throw "Error posting OSM elements: " + error;
    }
  },

  /**
   * Check if Overture elements exist in the database
   * @param overtureIds - Array of Overture element IDs
   * @returns Promise<ElementsResponse>
   */
  async getOvertureElements(overtureIds: string[]): Promise<ElementsResponse> {
    if (overtureIds.length === 0) {
      return { elements: [] };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/overture/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: overtureIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ElementsResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching Overture elements:", error);
      throw "Error fetching Overture elements: " + error;
    }
  },

  /**
   * Mark Overture elements as seen/processed (skipped/not matching)
   * @param overtureIds - Array of Overture element IDs
   * @returns Promise with success status
   */
  async postOvertureElements(overtureIds: string[]): Promise<{
    success: boolean;
    count: number;
    timestamp: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/overture/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: overtureIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error posting Overture elements:", error);
      throw "Error posting Overture elements: " + error;
    }
  },
};
