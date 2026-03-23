"""Webhook URL validation with SSRF prevention."""
import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"}


def validate_webhook_url(url: str) -> None:
    """Validate that a webhook URL is safe to call (no SSRF).

    Raises ValueError if the URL is invalid or points to a private/reserved IP.
    """
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError("Webhook URL must use HTTPS")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: no hostname")

    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise ValueError("Webhook URL cannot point to localhost")

    # Resolve hostname and check if IP is private/reserved
    try:
        for family, _, _, _, sockaddr in socket.getaddrinfo(hostname, None):
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise ValueError("Webhook URL cannot point to a private or reserved IP address")
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {hostname}")
