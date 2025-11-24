import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  points: [number, number][];
  zoom?: number;
}

const Map: React.FC<MapProps> = ({ points, zoom = 15 }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // We expect exactly 2 coordinates for the two points
    if (points.length !== 2) {
      console.log(points);
      console.warn("Map expects exactly 2 coordinates for two points");
      return;
    }

    const [point1, point2] = points;

    // Calculate bounds from the two points
    const bounds = new maplibregl.LngLatBounds(point1, point1).extend(point2);

    // Initialize the map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "raster-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: "simple-tiles",
            type: "raster",
            source: "raster-tiles",
            minzoom: 0,
            maxzoom: 24,
          },
        ],
      },
      bounds: bounds,
      fitBoundsOptions: {
        padding: 100,
        maxZoom: 19,
      },
    });

    map.current.on("style.load", () => {
      // Add source for the arrow line between points
      map.current?.addSource("arrow-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [point1, point2],
          },
        },
      });

      // Add the connecting line layer
      map.current?.addLayer({
        id: "arrow-line-layer",
        type: "line",
        source: "arrow-line",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            2,
            15,
            3,
            17,
            4,
            22,
            6,
          ],
          "line-opacity": 0.7,
        },
      });

      // Add arrowhead decoration on the line
      map.current?.addLayer({
        id: "arrow-line-decoration",
        type: "symbol",
        source: "arrow-line",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 1000, // Large spacing so we only get one arrow
          "text-field": "→",
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            16,
            15,
            24,
            17,
            32,
            22,
            48,
          ],
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
        },
        paint: {
          "text-color": "#3b82f6",
          "text-opacity": 0.8,
        },
      });

      // Add source for the two points
      map.current?.addSource("points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { type: "start" },
              geometry: {
                type: "Point",
                coordinates: point1,
              },
            },
            {
              type: "Feature",
              properties: { type: "end" },
              geometry: {
                type: "Point",
                coordinates: point2,
              },
            },
          ],
        },
      });

      // Add outer circle for points (larger, semi-transparent)
      map.current?.addLayer({
        id: "points-outer",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            8,
            15,
            12,
            17,
            16,
            22,
            24,
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "start",
            "#22c55e", // Green for start point
            "end",
            "#ef4444", // Red for end point
            "#3b82f6",
          ],
          "circle-opacity": 0.3,
        },
      });

      // Add inner circle for points (smaller, solid)
      map.current?.addLayer({
        id: "points-inner",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            5,
            15,
            7,
            17,
            9,
            22,
            14,
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "start",
            "#22c55e", // Green for start point
            "end",
            "#ef4444", // Red for end point
            "#3b82f6",
          ],
          "circle-opacity": 1,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    });

    // Cleanup on unmount
    return () => {
      map.current?.remove();
    };
  }, [points, zoom]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute bottom-2 md:bottom-auto md:top-2 left-2 z-10 w-40 md:w-72"></div>
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
    </div>
  );
};

export default Map;
