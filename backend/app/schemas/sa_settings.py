from typing import Optional
from pydantic import BaseModel


class SAProfileOut(BaseModel):
    company_name: str = ""
    company_email: str = ""
    company_phone: str = ""
    company_address: str = ""
    company_logo: Optional[str] = None


class SAProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None


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
