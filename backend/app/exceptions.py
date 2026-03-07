"""Custom exception classes for the ICT LMS backend."""


class NotFoundError(Exception):
    def __init__(self, entity: str = "Resource", entity_id: str = ""):
        self.entity = entity
        self.entity_id = entity_id
        super().__init__(f"{entity} not found" + (f": {entity_id}" if entity_id else ""))


class DuplicateError(Exception):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message)


class ForbiddenError(Exception):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message)


class ValidationError(Exception):
    def __init__(self, message: str = "Validation error"):
        super().__init__(message)
