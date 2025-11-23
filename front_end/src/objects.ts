interface Bounds {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface Tags {
  name?: string;
  phone?: string;
  amenity?: string;
  shop?: string;
  website?: string;
  "contact:facebook"?: string;
  "addr:housenumber"?: string;
  "addr:street"?: string;
  "addr:postcode"?: string;
  "addr:state"?: string;
  [key: string]: string | undefined; // Allow for other potential tags
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  tags: Tags;
  version: number;
  user: string;
}

export interface OsmNode extends OsmElement {
  type: "node";
  lat: number;
  lon: number;
}

export interface OsmWay extends OsmElement {
  type: "way";
  bounds: Bounds;
  nodes: number[];
  geometry: Coordinate[];
}

export interface OsmRelation extends OsmElement {
  type: "relation";
  bounds: Bounds;
  members: OsmMember[];
}

export interface OsmMember {
  type: "node" | "way" | "relation";
  ref: number;
  role: string;
}

export interface OsmAuthOptions {
  url: string;
  oauth_consumer_key: string;
  oauth_secret: string;
  oauth_token?: string;
  oauth_token_secret?: string;
  singlepage?: boolean;
}

export interface OsmUser {
  id: string;
  display_name: string;
}

export interface ZxyTileType {
  zoom: number;
  x: number;
  y: number;
  hasParams: boolean;
}
