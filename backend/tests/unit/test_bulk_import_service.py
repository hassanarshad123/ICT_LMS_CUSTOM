"""Unit tests for bulk_import_service — pure validation paths.

Row-by-row processing that hits the DB is covered by the integration smoke
test. Here we exercise CSV parsing, size guards, and entity-type validation.
"""
from __future__ import annotations

import io
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import bulk_import_service
from app.services.bulk_import_service import BulkImportError, TEMPLATES


class TestTemplates:
    def test_students_template_has_required_columns(self):
        assert "name" in TEMPLATES["students"]
        assert "email" in TEMPLATES["students"]

    def test_fee_plans_template_has_required_columns(self):
        assert "student_email" in TEMPLATES["fee_plans"]
        assert "batch_name" in TEMPLATES["fee_plans"]
        assert "plan_type" in TEMPLATES["fee_plans"]
        assert "total_amount" in TEMPLATES["fee_plans"]

    def test_payments_template_has_required_columns(self):
        assert "student_email" in TEMPLATES["payments"]
        assert "batch_name" in TEMPLATES["payments"]
        assert "amount" in TEMPLATES["payments"]
        assert "payment_date" in TEMPLATES["payments"]

    def test_all_three_entities_covered(self):
        assert set(TEMPLATES.keys()) == {"students", "fee_plans", "payments"}


class TestCreateJobValidation:
    @pytest.mark.asyncio
    async def test_rejects_unknown_entity(self):
        session = AsyncMock()
        with pytest.raises(BulkImportError) as exc_info:
            await bulk_import_service.create_job(
                session,
                institute_id=uuid.uuid4(),
                created_by=uuid.uuid4(),
                entity_type="teachers",  # not supported
                csv_bytes=b"name,email\n",
            )
        assert "unsupported" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rejects_oversized_csv(self):
        session = AsyncMock()
        huge = b"name,email\n" + b"x,y\n" * (11 * 1024 * 1024 // 4)  # >10 MB
        with pytest.raises(BulkImportError) as exc_info:
            await bulk_import_service.create_job(
                session,
                institute_id=uuid.uuid4(),
                created_by=uuid.uuid4(),
                entity_type="students",
                csv_bytes=huge,
            )
        assert "10 mb" in str(exc_info.value).lower() or "exceeds" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rejects_non_utf8(self):
        session = AsyncMock()
        # Latin-1 bytes that aren't valid UTF-8
        bad_bytes = b"name,email\n\xe9\xe0\xe7,test@example.com\n"
        # Use actual invalid UTF-8 sequence
        bad_bytes = b"name,email\n\xff\xfe,test@example.com\n"
        with pytest.raises(BulkImportError) as exc_info:
            await bulk_import_service.create_job(
                session,
                institute_id=uuid.uuid4(),
                created_by=uuid.uuid4(),
                entity_type="students",
                csv_bytes=bad_bytes,
            )
        assert "utf-8" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rejects_too_many_rows(self):
        session = AsyncMock()
        # > MAX_ROWS_PER_IMPORT (5000)
        rows = "\n".join(f"Name{i},user{i}@example.com,+1234567890,Batch A"
                         for i in range(6000))
        csv = f"name,email,phone,batch_name\n{rows}\n".encode()
        with pytest.raises(BulkImportError) as exc_info:
            await bulk_import_service.create_job(
                session,
                institute_id=uuid.uuid4(),
                created_by=uuid.uuid4(),
                entity_type="students",
                csv_bytes=csv,
            )
        assert "5000" in str(exc_info.value) or "max" in str(exc_info.value).lower()


class TestBomTolerance:
    """Excel 'Save As CSV UTF-8' prepends a BOM (U+FEFF). We must accept it."""

    @pytest.mark.asyncio
    async def test_csv_with_bom_accepted(self):
        session = AsyncMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        csv = "\ufeffname,email,phone,batch_name\nAlice,alice@ex.com,,\n".encode("utf-8")

        # Should not raise on the decode step
        try:
            job = await bulk_import_service.create_job(
                session,
                institute_id=uuid.uuid4(),
                created_by=uuid.uuid4(),
                entity_type="students",
                csv_bytes=csv,
            )
        except BulkImportError as e:
            pytest.fail(f"BOM-prefixed CSV should be accepted, got: {e}")

        # 1 data row (header + 1 entry)
        assert session.add.called


class TestConstants:
    def test_max_rows_per_import(self):
        assert bulk_import_service.MAX_ROWS_PER_IMPORT == 5000

    def test_max_errors_stored(self):
        # Cap errors to keep the JSONB field small — 500 rows is plenty to fix
        assert bulk_import_service.MAX_ERRORS_STORED == 500
