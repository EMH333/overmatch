import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  points: [number, number][];
  zoom?: number;
}

const Map: React.FC<MapProps> = ({ points, zoom = 15 }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Default view: continental US
    const defaultCenter: [number, number] = [-98.5795, 39.8283];
    const defaultZoom = 4;

    // Check if we have valid data
    const hasValidData = points.length === 2;

    const mapConfig: maplibregl.MapOptions = hasValidData
      ? (() => {
          const [point1, point2] = points;
          // Calculate bounds from the two points
          const bounds = new maplibregl.LngLatBounds(point1, point1).extend(
            point2,
          );
          return {
            container: mapContainer.current!,
            style: isDarkMode
              ? "https://tiles.openfreemap.org/styles/positron"
              : "https://tiles.openfreemap.org/styles/fiord",
            bounds: bounds,
            fitBoundsOptions: {
              padding: 100,
              maxZoom: 19,
            },
          };
        })()
      : {
          container: mapContainer.current!,
          style: isDarkMode
            ? "https://tiles.openfreemap.org/styles/positron"
            : "https://tiles.openfreemap.org/styles/fiord",
          center: defaultCenter,
          zoom: defaultZoom,
        };

    // Initialize the map
    map.current = new maplibregl.Map(mapConfig);

    map.current.on("style.load", () => {
      // Only add overlays if we have valid data
      if (!hasValidData) return;

      const [point1, point2] = points;
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
  }, [points, zoom, isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute bottom-2 md:bottom-auto md:top-2 left-2 z-10">
        <button
          onClick={toggleTheme}
          className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg shadow-lg transition-colors duration-200 flex items-center gap-2"
          aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
        >
          {isDarkMode ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
    </div>
  );
};

export default Map;
