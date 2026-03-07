"""Enum value transformers between API (kebab-case) and DB (snake_case)."""


def to_api(value: str) -> str:
    """Convert snake_case DB value to kebab-case API value."""
    return value.replace("_", "-")


def to_db(value: str) -> str:
    """Convert kebab-case API value to snake_case DB value."""
    return value.replace("-", "_")
