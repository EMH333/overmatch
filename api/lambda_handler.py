"""
AWS Lambda handler for the FastAPI application.

This module uses Mangum to adapt the FastAPI application for AWS Lambda.
"""

from mangum import Mangum
from .main import app

# Create the Lambda handler
handler = Mangum(app, lifespan="off")


def lambda_handler(event, context):
    """
    AWS Lambda entry point.

    Args:
        event: AWS Lambda event object
        context: AWS Lambda context object

    Returns:
        Response object for API Gateway
    """
    return handler(event, context)
