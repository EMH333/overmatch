import duckdb
import time
from datetime import datetime
from .get_categories import get_subcategories

# Start timing
start_time = time.time()
start_datetime = datetime.now()

release = "2025-11-19.0"  # latest Overture release
division_id = "f39eb4af-5206-481b-b19e-bd784ded3f05"  # US

confidence = 0.6

categories = ", ".join(
    [f"'{cat}'" for cat in get_subcategories(["restaurant", "bar", "cafe"])]
)


base = f"""INSTALL spatial; -- noqa
LOAD spatial; -- noqa
SET s3_region='us-west-2';

-- Set the division_id
SET variable division_id = '{division_id}';

-- Fetch the bounds and geometry of the Region
CREATE OR REPLACE TABLE bounds AS (
    SELECT
        id AS division_id, names.primary, geometry, bbox
    FROM
        read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=divisions/type=division_area/*.parquet')
    WHERE
        division_id = getvariable('division_id')
);

-- Extract the bounds and geometry of the division into variables for faster table scan
SET variable xmin = (SELECT bbox.xmin FROM bounds LIMIT 1);
SET variable ymin = (SELECT bbox.ymin FROM bounds LIMIT 1);
SET variable xmax = (SELECT bbox.xmax FROM bounds LIMIT 1);
SET variable ymax = (SELECT bbox.ymax FROM bounds LIMIT 1);
SET variable boundary = (SELECT geometry FROM bounds LIMIT 1);

-- Create the GeoJSON output
COPY(
  SELECT
    * EXCLUDE (names, addresses, categories, socials, websites, emails, phones, brand, sources, bbox),
    names::JSON as names,
    addresses::JSON as addresses,
    categories::JSON as categories,
    socials::JSON as socials,
    websites::JSON as websites,
    emails::JSON as emails,
    phones::JSON as phones,
    brand::JSON as brand,
    sources::JSON as sources
  FROM
    read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', filename=true, hive_partitioning=1)
  WHERE
    -- Filter on bbox first (most selective, indexed)
    bbox.xmin > getvariable('xmin')
    AND bbox.xmax < getvariable('xmax')
    AND bbox.ymin > getvariable('ymin')
    AND bbox.ymax < getvariable('ymax')
    -- Then category filter (should use dictionary compression)
    AND categories.primary IN ({categories})
    -- Region check last (requires array access)
    AND addresses[1].country = 'US'
    -- Is open
    AND operating_status = 'open'
    -- Confidence about threshold
    AND confidence >= {confidence}
    -- Final geometry intersection check
    AND ST_INTERSECTS(
        getvariable('boundary'),
        geometry
    )
) TO 'overture.geojson' WITH (FORMAT GDAL, DRIVER 'GeoJSON');"""

print(base)
duckdb.sql(base)

# Calculate and display execution time
end_time = time.time()
end_datetime = datetime.now()
elapsed_seconds = end_time - start_time
elapsed_minutes = elapsed_seconds / 60

print(f"\n{'=' * 60}")
print("Script execution completed!")
print(f"Start time: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"End time: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Total time: {elapsed_minutes:.2f} minutes ({elapsed_seconds:.2f} seconds)")
print(f"{'=' * 60}")

# Log to file for later reference
with open("logs/build_query_timing.log", "a") as f:
    f.write(
        f"{start_datetime.strftime('%Y-%m-%d %H:%M:%S')} | "
        f"Duration: {elapsed_minutes:.2f} min ({elapsed_seconds:.2f} sec) | "
        f"Division: {division_id}\n"
    )
