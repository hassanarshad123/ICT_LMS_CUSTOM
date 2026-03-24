# Models

SQLModel ORM table definitions. All models use UUID primary keys and soft-delete via `deleted_at`.

Every model has an `institute_id` FK for multi-tenant isolation (nullable for super_admin records).

Key models: User, Institute, Batch, Course, Lecture, Quiz, Certificate, Notification, Job.

See `enums.py` for all status/type enumerations (UserRole, CourseStatus, etc.).
