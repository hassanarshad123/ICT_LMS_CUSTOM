"""Fernet encryption for storing sensitive credentials."""
from cryptography.fernet import Fernet

from app.config import get_settings

settings = get_settings()

_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.ZOOM_CREDENTIAL_ENCRYPTION_KEY
        if not key:
            raise ValueError("ZOOM_CREDENTIAL_ENCRYPTION_KEY not configured")
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
