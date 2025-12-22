#!/usr/bin/env python3
"""
Script to fetch Overture categories and filter for various subcategories.

This script downloads the Overture categories CSV file and extracts all category codes
where the targeted subcategories are in the specified position the taxonomy hierarchy.
"""

import requests


def fetch_overture_categories(url: str) -> list[tuple[str, str]]:
    """
    Fetch the Overture categories CSV from the given URL.

    Args:
        url: The URL to fetch the CSV from

    Returns:
        List of tuples containing (category_code, taxonomy_string)
    """
    categories = []

    # Fetch the CSV file
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad status codes

    # Decode the response and split into lines
    content = response.text
    rows = content.strip().split("\n")[1:]

    for row in rows:
        row = row.split(";")
        if len(row) == 2:
            category_code = row[0].strip()
            taxonomy = row[1].strip()
            categories.append((category_code, taxonomy))

    return categories


def parse_taxonomy(taxonomy_string: str) -> list[str]:
    """
    Parse the taxonomy string into a list of categories.

    Args:
        taxonomy_string: String like "[eat_and_drink,restaurant,afghan_restaurant]"

    Returns:
        List of category names
    """
    # Remove brackets and split by comma
    taxonomy_string = taxonomy_string.strip(" []")
    return [cat.strip() for cat in taxonomy_string.split(",")]


def filter_subcategories(
    targets: dict[int, list[str]], categories: list[tuple[str, str]]
) -> list[str]:
    """
    Filter categories where targets are in specified position in the taxonomy.

    Args:
        categories: List of tuples containing (category_code, taxonomy_string)

    Returns:
        List of category codes where targets are in the taxonomy
    """
    subcategories = []

    for category_code, taxonomy_string in categories:
        taxonomy_list = parse_taxonomy(taxonomy_string)

        for position, target in targets.items():
            if position > len(taxonomy_list):
                continue

            position -= 1
            if taxonomy_list[position] in target:
                subcategories.append(category_code)

    return subcategories


def get_subcategories(targets: dict[int, list[str]]) -> list[str]:
    """Main function to fetch and filter subcategories."""
    url = "https://raw.githubusercontent.com/OvertureMaps/schema/refs/heads/main/docs/schema/concepts/by-theme/places/overture_categories.csv"

    categories = fetch_overture_categories(url)
    subcategories = filter_subcategories(targets, categories)

    return subcategories


if __name__ == "__main__":
    # overture categories to filter for, based on position in the taxonomy
    targets: dict[int, list[str]] = {
        1: ["accommodation"],
        2: ["restaurant", "bar", "cafe"],
        3: ["grocery_store"],
    }

    print("Fetching Overture categories...")
    subcat = get_subcategories(targets)
    print(f"\nFound {len(subcat)} categories that match the targets")
