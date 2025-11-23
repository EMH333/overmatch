from .get_categories import get_subcategories

categories = ", ".join(
    [f"'{cat}'" for cat in get_subcategories(["restaurant", "bar", "cafe"])]
)


base = f"""LOAD spatial; -- noqa
SET s3_region='us-west-2';
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
    read_parquet('s3://overturemaps-us-west-2/release/2025-10-22.0/theme=places/type=place/*', filename=true, hive_partitioning=1)
  WHERE
    -- Filter on bbox first (most selective, indexed)
    bbox.xmin BETWEEN -77.5 AND -76.5
    AND bbox.ymin BETWEEN 38.5 AND 39.5
    -- Then category filter (should use dictionary compression)
    AND categories.primary IN ({categories})
    -- Region check last (requires array access)
    AND addresses[1].region = 'DC'
) TO 'dc_places.geojson' WITH (FORMAT GDAL, DRIVER 'GeoJSON');"""

print(base)
