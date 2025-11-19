from .get_categories import get_subcategories

categories = ", ".join(
    [f"'{cat}'" for cat in get_subcategories(["restaurant", "bar", "cafe"])]
)


base = f"""LOAD spatial; -- noqa
SET s3_region='us-west-2';
COPY(
  SELECT
    * EXCLUDE (names, addresses, categories, socials, websites, emails, phones, brand, sources, bbox),
    CAST(names AS JSON) as names,
    CAST(addresses AS JSON) as addresses,
    CAST(categories AS JSON) as categories,
    CAST(socials AS JSON) as socials,
    CAST(websites AS JSON) as websites,
    CAST(emails AS JSON) as emails,
    CAST(phones AS JSON) as phones,
    CAST(brand AS JSON) as brand,
    CAST(sources AS JSON) as sources
  FROM
    read_parquet('s3://overturemaps-us-west-2/release/2025-10-22.0/theme=places/type=place/*', filename=true, hive_partitioning=1)
  WHERE
    addresses[1].region = 'DC'
    AND bbox.xmin BETWEEN -77.5 AND -76.5
    AND bbox.ymin BETWEEN 38.5 AND 39.5
    AND (
      categories.primary IN ({categories})
    )
) TO 'dc_places.geojson' WITH (FORMAT GDAL, DRIVER 'GeoJSON');"""

print(base)
