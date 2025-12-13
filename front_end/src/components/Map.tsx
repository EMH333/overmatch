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
  const animationRef = useRef<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize with system preference
    if (typeof window !== "undefined") {
      const matches = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return matches;
    }
    return false;
  });
  const [styleLoaded, setStyleLoaded] =
    useState<maplibregl.StyleSpecification | null>(null);

  // Listen for system dark mode changes
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Fetch and cache the vector style
  useEffect(() => {
    const styleUrl = !isDarkMode
      ? "https://tiles.openfreemap.org/styles/positron"
      : "https://tiles.openfreemap.org/styles/fiord";

    fetch(styleUrl)
      .then((res) => res.json())
      .then((style: maplibregl.StyleSpecification) => {
        setStyleLoaded(style);
      })
      .catch((err) => {
        console.error("Failed to load map style:", err);
      });
  }, [isDarkMode]);

  // Initialize map once style is loaded
  useEffect(() => {
    if (!mapContainer.current || !styleLoaded) return;

    // Clean up existing map and animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    const hasValidData = points.length === 2;

    // Clone the style to avoid mutating the cached version
    const style = JSON.parse(
      JSON.stringify(styleLoaded),
    ) as maplibregl.StyleSpecification;

    // Add POI layers using circle markers (no glyphs needed)
    style.layers.push(
      // POI icons as colored circles - visible from zoom 14+
      {
        id: "poi-icons",
        type: "circle",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 14,
        filter: [
          "in",
          "class",
          "restaurant",
          "cafe",
          "bar",
          "fast_food",
          "hospital",
          "pharmacy",
          "fuel",
          "park",
          "school",
          "museum",
          "hotel",
          "bus",
          "railway",
        ],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            3,
            16,
            5,
            18,
            7,
          ],
          "circle-color": [
            "match",
            ["get", "class"],
            ["restaurant", "cafe", "bar", "fast_food"],
            "#ef4444",
            ["hospital", "pharmacy"],
            "#3b82f6",
            ["fuel"],
            "#f59e0b",
            ["park"],
            "#22c55e",
            ["school", "museum"],
            "#8b5cf6",
            ["hotel"],
            "#ec4899",
            ["bus", "railway"],
            "#06b6d4",
            "#6b7280",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      } as maplibregl.LayerSpecification,
      // POI labels - visible from zoom 15+
      {
        id: "poi-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "poi",
        minzoom: 15,
        filter: [
          "in",
          "class",
          "restaurant",
          "cafe",
          "bar",
          "fast_food",
          "hospital",
          "pharmacy",
          "fuel",
          "park",
          "school",
          "museum",
          "hotel",
          "bus",
          "railway",
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            9,
            17,
            11,
            19,
            13,
          ],
          "text-anchor": "top",
          "text-offset": [0, 0.8],
          "text-max-width": 8,
        },
        paint: {
          "text-color": isDarkMode ? "#e5e7eb" : "#3d4147",
          "text-halo-color": isDarkMode ? "#29374a" : "#ffffff",
          "text-halo-width": 2,
          // "text-halo-blur": 1,
        },
      } as maplibregl.LayerSpecification,
    );

    // If we have valid points, inject our custom sources and layers into the style
    if (hasValidData) {
      const [point1, point2] = points;

      // Source for animated flowing dots (will be updated via animation)
      style.sources["animated-dots"] = {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      };

      // Source for the static trail (faint line of dots)
      const trailPoints: GeoJSON.Feature<GeoJSON.Point>[] = [];
      const numTrailPoints = 30;
      for (let i = 0; i <= numTrailPoints; i++) {
        const t = i / numTrailPoints;
        const lon = point1[0] + t * (point2[0] - point1[0]);
        const lat = point1[1] + t * (point2[1] - point1[1]);
        trailPoints.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
        });
      }

      style.sources["trail-dots"] = {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: trailPoints,
        },
      };

      // Source for endpoint markers
      style.sources["points"] = {
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
      };

      // Add our custom layers to the style
      style.layers.push(
        // Static trail dots (faint background)
        {
          id: "trail-dots-layer",
          type: "circle",
          source: "trail-dots",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              1,
              15,
              1.5,
              17,
              2,
              22,
              3,
            ],
            "circle-color": "#3b82f6",
            "circle-opacity": 0.2,
          },
        } as maplibregl.LayerSpecification,
        // Animated flowing dots
        {
          id: "animated-dots-layer",
          type: "circle",
          source: "animated-dots",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              3,
              15,
              4,
              17,
              5,
              22,
              7,
            ],
            "circle-color": "#3b82f6",
            "circle-opacity": ["get", "opacity"],
            "circle-blur": 0.2,
          },
        } as maplibregl.LayerSpecification,
        // Outer glow for endpoint markers
        {
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
              "#ef4444",
              "end",
              "#22c55e",
              "#3b82f6",
            ],
            "circle-opacity": 0.3,
          },
        } as maplibregl.LayerSpecification,
        // Inner solid endpoint markers
        {
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
              "#ef4444",
              "end",
              "#22c55e",
              "#3b82f6",
            ],
            "circle-opacity": 1,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        } as maplibregl.LayerSpecification,
      );
    }

    // Create map config
    const mapConfig: maplibregl.MapOptions = hasValidData
      ? (() => {
          const [point1, point2] = points;
          const bounds = new maplibregl.LngLatBounds(point1, point1).extend(
            point2,
          );
          return {
            container: mapContainer.current!,
            style: style,
            bounds: bounds,
            fitBoundsOptions: {
              padding: 100,
              maxZoom: 19,
            },
          };
        })()
      : {
          container: mapContainer.current!,
          style: style,
          bounds: new maplibregl.LngLatBounds(
            [-124.848974, 24.396308],
            [-66.885444, 49.384358],
          ),
          fitBoundsOptions: {
            padding: 50,
          },
        };

    map.current = new maplibregl.Map(mapConfig);

    // Start animation once map loads
    if (hasValidData) {
      map.current.on("load", () => {
        const [point1, point2] = points;
        const numDots = 4; // Number of animated dots
        const speed = 0.0015; // Speed of animation

        let offsets = Array.from({ length: numDots }, (_, i) => i / numDots);

        const animate = () => {
          if (!map.current) return;

          // Update offsets
          offsets = offsets.map((offset) => {
            const newOffset = offset + speed;
            return newOffset > 1 ? newOffset - 1 : newOffset;
          });

          // Generate dot positions with opacity based on position
          // Animation goes from point2 (end/Overture) to point1 (start/OSM)
          const features: GeoJSON.Feature<GeoJSON.Point>[] = offsets.map(
            (offset) => {
              const lon = point2[0] + offset * (point1[0] - point2[0]);
              const lat = point2[1] + offset * (point1[1] - point2[1]);

              // Fade in at start, full opacity in middle, fade out at end
              let opacity = 1;
              if (offset < 0.1) {
                opacity = offset / 0.1;
              } else if (offset > 0.9) {
                opacity = (1 - offset) / 0.1;
              }

              return {
                type: "Feature",
                properties: { opacity },
                geometry: {
                  type: "Point",
                  coordinates: [lon, lat],
                },
              };
            },
          );

          // Update the source
          const source = map.current.getSource(
            "animated-dots",
          ) as maplibregl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "FeatureCollection",
              features,
            });
          }

          animationRef.current = requestAnimationFrame(animate);
        };

        animate();
      });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  }, [points, zoom, styleLoaded, isDarkMode]);

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
