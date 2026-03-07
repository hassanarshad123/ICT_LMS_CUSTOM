"""Formatting utilities for display values."""


def format_duration(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}.{minutes * 10 // 60} hours" if minutes else f"{hours} hours"
    return f"{minutes} min"


def format_file_size(size_bytes: int | None) -> str | None:
    if size_bytes is None:
        return None
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
