"""SA business profile and payment method settings.

Stores in SystemSetting with institute_id = NULL (SA-level settings).
"""
import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.settings import SystemSetting

_PROFILE_KEYS = [
    "sa_company_name",
    "sa_company_email",
    "sa_company_phone",
    "sa_company_address",
    "sa_company_logo",
]

_PAYMENT_KEY = "sa_payment_methods"


async def _get_setting(session: AsyncSession, key: str) -> Optional[str]:
    r = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == key,
            SystemSetting.institute_id.is_(None),
        )
    )
    setting = r.scalar_one_or_none()
    return setting.value if setting else None


async def _upsert_setting(session: AsyncSession, key: str, value: str) -> None:
    r = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == key,
            SystemSetting.institute_id.is_(None),
        )
    )
    setting = r.scalar_one_or_none()
    if setting:
        setting.value = value
        setting.updated_at = datetime.now(timezone.utc)
        session.add(setting)
    else:
        session.add(SystemSetting(
            setting_key=key,
            value=value,
            description=f"SA setting: {key}",
            institute_id=None,
        ))


async def get_sa_profile(session: AsyncSession) -> dict:
    result = {}
    for key in _PROFILE_KEYS:
        val = await _get_setting(session, key)
        # Strip "sa_company_" prefix for the response
        field = key.replace("sa_company_", "company_")
        result[field] = val or ""
    return result


async def update_sa_profile(session: AsyncSession, updates: dict) -> dict:
    for field, value in updates.items():
        if value is not None:
            key = f"sa_{field}"
            await _upsert_setting(session, key, value)
    await session.commit()
    return await get_sa_profile(session)


async def update_sa_logo(session: AsyncSession, logo_data_url: str) -> dict:
    await _upsert_setting(session, "sa_company_logo", logo_data_url)
    await session.commit()
    return await get_sa_profile(session)


async def get_payment_methods(session: AsyncSession) -> list[dict]:
    val = await _get_setting(session, _PAYMENT_KEY)
    if not val:
        return []
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return []


async def update_payment_methods(session: AsyncSession, methods: list[dict]) -> list[dict]:
    await _upsert_setting(session, _PAYMENT_KEY, json.dumps(methods))
    await session.commit()
    return methods
