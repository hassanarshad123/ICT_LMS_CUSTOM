# Schemas

Pydantic DTOs for request validation and response serialization.

1:1 mapping with routers (auth.py schema matches auth.py router).
`common.py` contains PaginatedResponse[T] used by all list endpoints.

Frontend uses camelCase; backend uses snake_case.
Conversion happens in the frontend API client, not here.
