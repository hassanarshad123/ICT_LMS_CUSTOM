"""Generate SECRET_KEY and ENCRYPTION_KEY for .env configuration."""
import secrets
from cryptography.fernet import Fernet


def main():
    print("Add these to your .env file:\n")
    print(f"JWT_SECRET_KEY={secrets.token_urlsafe(64)}")
    print(f"ZOOM_CREDENTIAL_ENCRYPTION_KEY={Fernet.generate_key().decode()}")


if __name__ == "__main__":
    main()
