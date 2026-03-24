# Services

Business logic layer. Each service takes an AsyncSession and returns domain objects.

One service per domain: auth, user, batch, course, lecture, quiz, certificate, etc.

Services handle: validation, authorization scoping, multi-tenant filtering,
cache integration (Redis), and database operations.

Largest services: certificate_service (PDF generation), zoom_service (Zoom API).
