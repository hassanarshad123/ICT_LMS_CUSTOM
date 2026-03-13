"""Seed script: creates admin user + default system settings."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import async_session
from app.models.user import User
from app.models.settings import SystemSetting
from app.models.enums import UserRole
from app.utils.security import hash_password


async def seed():
    async with async_session() as session:
        # Admin user
        result = await session.execute(
            select(User).where(User.email == "admin@ictlms.com")
        )
        if not result.scalar_one_or_none():
            admin = User(
                email="admin@ictlms.com",
                name="System Admin",
                hashed_password=hash_password("admin123"),
                role=UserRole.admin,
            )
            session.add(admin)
            print("Created admin user: admin@ictlms.com / admin123")
        else:
            print("Admin user already exists")

        # System settings
        defaults = {
            "max_device_limit": ("2", "Maximum concurrent devices per user"),
            "post_batch_grace_period_days": ("90", "Days after batch ends that students can still access content"),
        }
        for key, (value, desc) in defaults.items():
            result = await session.execute(
                select(SystemSetting).where(SystemSetting.setting_key == key)
            )
            if not result.scalar_one_or_none():
                session.add(SystemSetting(setting_key=key, value=value, description=desc))
                print(f"Created setting: {key}={value}")

        await session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
