from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.validators import ValidatedEmail


class SAProfileOut(BaseModel):
    company_name: str = ""
    company_email: str = ""
    company_phone: str = ""
    company_address: str = ""
    company_logo: Optional[str] = None


class SAProfileUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    company_email: Optional[ValidatedEmail] = None
    company_phone: Optional[str] = Field(default=None, max_length=20)
    company_address: Optional[str] = Field(default=None, max_length=500)


class SALogoUpload(BaseModel):
    logo: str  # base64 data URL


class PaymentMethodItem(BaseModel):
    type: str  # bank_transfer, jazzcash, easypaisa, custom
    label: str
    details: dict  # flexible: bank_name, account_title, account_number, iban, phone, etc.


class SAPaymentMethodsOut(BaseModel):
    methods: list[PaymentMethodItem] = []


class SAPaymentMethodsUpdate(BaseModel):
    methods: list[PaymentMethodItem]
