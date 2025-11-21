"""
DynamoDB manager for storing and retrieving element tracking data.
"""

import boto3
from botocore.exceptions import ClientError
from typing import Dict, Optional


class DynamoDBManager:
    """
    Manages DynamoDB operations for element tracking.

    Each element is stored with:
    - element_id (partition key): The unique identifier for the element
    - first_seen: ISO 8601 timestamp when element was first added
    - last_seen: ISO 8601 timestamp when element was last accessed
    """

    def __init__(self, table_name: str, region_name: str = "us-east-1"):
        """
        Initialize DynamoDB manager.

        Args:
            table_name: Name of the DynamoDB table
            region_name: AWS region name
        """
        self.table_name = table_name
        self.region_name = region_name

        # Initialize boto3 client
        # In Lambda, boto3 will automatically use the execution role
        # For local development, use AWS credentials from environment/config
        self.dynamodb = boto3.resource("dynamodb", region_name=region_name)
        self.table = self.dynamodb.Table(table_name)

    def get_element(self, element_id: str) -> Optional[Dict]:
        """
        Retrieve an element from the database.

        Args:
            element_id: The unique identifier for the element

        Returns:
            Dictionary with element data if found, None otherwise
        """
        try:
            response = self.table.get_item(Key={"element_id": element_id})
            return response.get("Item")
        except ClientError as e:
            print(f"Error getting element {element_id}: {e}")
            return None

    def put_element(self, element_id: str, timestamp: str) -> bool:
        """
        Add or update an element in the database.

        If the element doesn't exist, creates it with first_seen and last_seen.
        If it exists, only updates last_seen (preserves first_seen).

        Args:
            element_id: The unique identifier for the element
            timestamp: ISO 8601 timestamp string

        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if element exists
            existing = self.get_element(element_id)

            if existing:
                # Update only last_seen, preserve first_seen
                self.table.update_item(
                    Key={"element_id": element_id},
                    UpdateExpression="SET last_seen = :timestamp",
                    ExpressionAttributeValues={":timestamp": timestamp},
                )
            else:
                # Create new element with both timestamps
                self.table.put_item(
                    Item={
                        "element_id": element_id,
                        "first_seen": timestamp,
                        "last_seen": timestamp,
                    }
                )
            return True
        except ClientError as e:
            print(f"Error putting element {element_id}: {e}")
            return False

    def update_last_seen(self, element_id: str, timestamp: str) -> bool:
        """
        Update the last_seen timestamp for an element.

        Args:
            element_id: The unique identifier for the element
            timestamp: ISO 8601 timestamp string

        Returns:
            True if successful, False otherwise
        """
        try:
            self.table.update_item(
                Key={"element_id": element_id},
                UpdateExpression="SET last_seen = :timestamp",
                ExpressionAttributeValues={":timestamp": timestamp},
            )
            return True
        except ClientError as e:
            print(f"Error updating last_seen for {element_id}: {e}")
            return False

    def batch_get_elements(self, element_ids: list[str]) -> Dict[str, Dict]:
        """
        Retrieve multiple elements in a single batch request.

        This is more efficient than multiple individual get_element calls.

        Args:
            element_ids: List of element IDs to retrieve

        Returns:
            Dictionary mapping element_id to element data
        """
        try:
            # DynamoDB batch_get_item has a limit of 100 items
            results = {}

            for i in range(0, len(element_ids), 100):
                batch = element_ids[i : i + 100]

                response = self.dynamodb.batch_get_item(
                    RequestItems={
                        self.table_name: {
                            "Keys": [{"element_id": eid} for eid in batch]
                        }
                    }
                )

                for item in response.get("Responses", {}).get(self.table_name, []):
                    results[item["element_id"]] = item

            return results
        except ClientError as e:
            print(f"Error batch getting elements: {e}")
            return {}

    def batch_put_elements(self, element_ids: list[str], timestamp: str) -> bool:
        """
        Add multiple elements in batch requests.

        More efficient than multiple put_element calls, but doesn't preserve
        existing first_seen timestamps. Use for initial bulk inserts only.

        Args:
            element_ids: List of element IDs to add
            timestamp: ISO 8601 timestamp string

        Returns:
            True if successful, False otherwise
        """
        try:
            # DynamoDB batch_write_item has a limit of 25 items
            for i in range(0, len(element_ids), 25):
                batch = element_ids[i : i + 25]

                with self.table.batch_writer() as writer:
                    for element_id in batch:
                        writer.put_item(
                            Item={
                                "element_id": element_id,
                                "first_seen": timestamp,
                                "last_seen": timestamp,
                            }
                        )
            return True
        except ClientError as e:
            print(f"Error batch putting elements: {e}")
            return False
