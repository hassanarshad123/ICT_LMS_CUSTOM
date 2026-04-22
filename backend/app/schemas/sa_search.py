from pydantic import BaseModel


class SearchResultItem(BaseModel):
    id: str
    label: str
    sublabel: str | None = None
    entity_type: str
    url: str


class SASearchResponse(BaseModel):
    institutes: list[SearchResultItem] = []
    users: list[SearchResultItem] = []
    invoices: list[SearchResultItem] = []
    payments: list[SearchResultItem] = []
    courses: list[SearchResultItem] = []
    activity: list[SearchResultItem] = []
