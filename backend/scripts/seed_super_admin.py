"""
Run once on fresh DB to create the super_admin user.

Usage:
    cd backend
    SUPER_ADMIN_EMAIL=admin@zensbot.com SUPER_ADMIN_PASSWORD=changeme123 python scripts/seed_super_admin.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from app.database import async_session
    from app.models.user import User
    from app.models.enums import UserRole, UserStatus
    from app.utils.security import hash_password
    from sqlmodel import select

    email = os.environ.get("SUPER_ADMIN_EMAIL", "superadmin@zensbot.com")
    password = os.environ.get("SUPER_ADMIN_PASSWORD", "changeme123")
    name = os.environ.get("SUPER_ADMIN_NAME", "Zensbot Super Admin")

    async with async_session() as session:
        # Check if already exists
        result = await session.execute(
            select(User).where(User.email == email, User.institute_id.is_(None))
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Super admin already exists: {email}")
            return

        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(password),
            role=UserRole.super_admin,
            institute_id=None,  # super_admin has no institute
        )
        session.add(user)
        await session.commit()
        print(f"Created super admin: {email}")


if __name__ == "__main__":
    asyncio.run(main())
