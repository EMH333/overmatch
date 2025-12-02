"""
Script to fetch OpenStreetMap data from QLever API.
"""

import requests
import json
import sys
import datetime

# Configuration
QLEVER_ENDPOINT = "https://qlever.dev/api/osm-planet"
# relation = 162069  # DC
relation = 148838  # US

# SPARQL query
query = f"""
PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX osmrel: <https://www.openstreetmap.org/relation/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX osm: <https://www.openstreetmap.org/>
PREFIX ogc: <http://www.opengis.net/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?id ?name ?housenumber ?centroid WHERE {{
  # Washington
  osmrel:{relation} ogc:sfIntersects ?id .
  VALUES ?amenity_types {{
    # amenity=* values
    "restaurant" "bar" "pub" "fast_food" "cafe"
  }}
  ?id osmkey:amenity ?amenity_types .
  ?id osmkey:name ?name .
  OPTIONAL {{ ?id osmkey:addr:housenumber ?housenumber . }}
  ?id geo:hasGeometry/geo:asWKT ?geometry .
  BIND(geof:centroid(?geometry) AS ?centroid)
}}"""


def fetch_osm_data(query_string):
    """
    Fetch data from QLever API.

    Args:
        query_string: SPARQL query string

    Returns:
        List of results, where each result is [id, name, geometry]
    """
    try:
        # Prepare the request
        params = {"query": query_string}

        print(f"Fetching data from {QLEVER_ENDPOINT}...", file=sys.stderr)

        # Make the request
        response = requests.get(QLEVER_ENDPOINT, params=params)
        response.raise_for_status()

        # Parse JSON response
        data = response.json()

        results = data["results"]["bindings"]

        print(f"Fetched {len(results)} results", file=sys.stderr)

        return results

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}", file=sys.stderr)
        return []


def main():
    """Main function to fetch and display OSM data."""
    results = fetch_osm_data(query)

    if not results:
        print("No results found or error occurred", file=sys.stderr)
        return

    # Process and display results
    print(f"\nFound {len(results)} amenities:\n")

    output = []
    for result in results:
        if len(result) >= 3:
            osm_id = (
                result.get("id")
                .get("value")
                .removeprefix("https://www.openstreetmap.org/")
            )
            name = result.get("name").get("value")
            housenumber = result.get("housenumber", {"value": None}).get("value")
            geometry = result.get("centroid").get("value")
            object = {
                "type": "Feature",
                "properties": {
                    "@id": osm_id,
                    "name": name,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        float(x)
                        for x in geometry.removeprefix("POINT(")
                        .removesuffix(")")
                        .split(" ")
                    ],
                },
            }
            if housenumber:
                object["properties"]["addr:housenumber"] = housenumber
            output.append(object)

        else:
            print(f"Warning: Unexpected result format: {result}", file=sys.stderr)

    # Optionally save to file
    output_file = "osm_qlever.geojson"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "type": "FeatureCollection",
                "timestamp": str(datetime.datetime.now()),
                "features": output,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\nResults saved to {output_file}")


if __name__ == "__main__":
    main()
