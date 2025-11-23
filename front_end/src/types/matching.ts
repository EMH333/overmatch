/**
 * Types for the Overmatch Element Tracking API
 */

export interface MatchInfo {
  osm_id: string;
  overture_id: string;
  lon: number;
  lat: number;
  distance_m: number;
  similarity: number;
  overture_tags: Record<string, any>;
}

export interface MatchStatus {
  osm_id: string;
  has_match: boolean;
  matches: MatchInfo[];
}

export interface MatchesResponse {
  elements: MatchStatus[];
}

export interface ElementStatus {
  id: string;
  exists: boolean;
  first_seen?: string | null;
  last_seen?: string | null;
}

export interface ElementsResponse {
  elements: ElementStatus[];
}

export interface ElementRequest {
  ids: string[];
}

export interface PostResponse {
  success: boolean;
  count: number;
  timestamp: string;
}
