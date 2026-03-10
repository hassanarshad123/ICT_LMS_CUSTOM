// ── Type Definitions ─────────────────────────────────────────

export interface ParamDef {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface FieldDef {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

export interface EndpointDef {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  pathParams?: ParamDef[];
  queryParams?: ParamDef[];
  requestBody?: { fields: FieldDef[]; example: object };
  responseSchema: { fields: FieldDef[]; example: object };
  webhookEvent?: string;
}

export interface EndpointGroup {
  name: string;
  description: string;
  endpoints: EndpointDef[];
}

export interface WebhookEventDef {
  event: string;
  description: string;
  examplePayload: object;
}

export interface WebhookEventGroup {
  name: string;
  events: WebhookEventDef[];
}

// ── Common Query Params ─────────────────────────────────────

const PAGINATION_PARAMS: ParamDef[] = [
  { name: 'page', type: 'integer', required: false, description: 'Page number (starts at 1)', default: '1' },
  { name: 'per_page', type: 'integer', required: false, description: 'Items per page (1-100)', default: '20' },
];

// ── Endpoint Definitions ────────────────────────────────────

export const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    name: 'Students',
    description: 'Manage student accounts in your institute.',
    endpoints: [
      {
        id: 'list-students',
        method: 'GET',
        path: '/students',
        summary: 'List all students',
        description: 'Retrieve a paginated list of students. Supports filtering by status and search by name/email.',
        queryParams: [
          ...PAGINATION_PARAMS,
          { name: 'search', type: 'string', required: false, description: 'Search by name or email' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: active, inactive, suspended' },
        ],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Student UUID' },
            { name: 'email', type: 'string', description: 'Email address' },
            { name: 'name', type: 'string', description: 'Full name' },
            { name: 'phone', type: 'string | null', description: 'Phone number' },
            { name: 'status', type: 'string', description: 'Account status' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: {
            data: [
              { id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com', name: 'John Doe', phone: '+91-9876543210', status: 'active', created_at: '2026-01-15T10:30:00Z' },
            ],
            total: 42, page: 1, per_page: 20, total_pages: 3,
          },
        },
      },
      {
        id: 'get-student',
        method: 'GET',
        path: '/students/{student_id}',
        summary: 'Get a student by ID',
        description: 'Retrieve detailed information about a specific student.',
        pathParams: [{ name: 'student_id', type: 'uuid', required: true, description: 'The student UUID' }],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Student UUID' },
            { name: 'email', type: 'string', description: 'Email address' },
            { name: 'name', type: 'string', description: 'Full name' },
            { name: 'phone', type: 'string | null', description: 'Phone number' },
            { name: 'status', type: 'string', description: 'Account status' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com', name: 'John Doe', phone: '+91-9876543210', status: 'active', created_at: '2026-01-15T10:30:00Z' },
        },
      },
      {
        id: 'create-student',
        method: 'POST',
        path: '/students',
        summary: 'Create a new student',
        description: 'Create a new student account. A random password is generated if not provided.',
        requestBody: {
          fields: [
            { name: 'email', type: 'string', description: 'Email address', required: true },
            { name: 'name', type: 'string', description: 'Full name', required: true },
            { name: 'password', type: 'string | null', description: 'Password (auto-generated if omitted)' },
            { name: 'phone', type: 'string | null', description: 'Phone number' },
          ],
          example: { email: 'jane@example.com', name: 'Jane Smith', phone: '+91-9876543211' },
        },
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Student UUID' },
            { name: 'email', type: 'string', description: 'Email address' },
            { name: 'name', type: 'string', description: 'Full name' },
            { name: 'phone', type: 'string | null', description: 'Phone number' },
            { name: 'status', type: 'string', description: 'Account status' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: { id: '660e8400-e29b-41d4-a716-446655440001', email: 'jane@example.com', name: 'Jane Smith', phone: '+91-9876543211', status: 'active', created_at: '2026-03-11T10:30:00Z' },
        },
        webhookEvent: 'user.created',
      },
      {
        id: 'update-student',
        method: 'PATCH',
        path: '/students/{student_id}',
        summary: 'Update a student',
        description: 'Update one or more fields on an existing student. Only provide the fields you want to change.',
        pathParams: [{ name: 'student_id', type: 'uuid', required: true, description: 'The student UUID' }],
        requestBody: {
          fields: [
            { name: 'name', type: 'string', description: 'Full name' },
            { name: 'phone', type: 'string', description: 'Phone number' },
            { name: 'email', type: 'string', description: 'Email address' },
          ],
          example: { name: 'Jane Smith-Johnson', phone: '+91-9876543222' },
        },
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Student UUID' },
            { name: 'email', type: 'string', description: 'Email address' },
            { name: 'name', type: 'string', description: 'Full name' },
            { name: 'phone', type: 'string | null', description: 'Phone number' },
            { name: 'status', type: 'string', description: 'Account status' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: { id: '660e8400-e29b-41d4-a716-446655440001', email: 'jane@example.com', name: 'Jane Smith-Johnson', phone: '+91-9876543222', status: 'active', created_at: '2026-03-11T10:30:00Z' },
        },
        webhookEvent: 'user.updated',
      },
    ],
  },
  {
    name: 'Batches',
    description: 'Retrieve batch (cohort) information.',
    endpoints: [
      {
        id: 'list-batches',
        method: 'GET',
        path: '/batches',
        summary: 'List all batches',
        description: 'Retrieve a paginated list of batches with teacher name, student count, and course count.',
        queryParams: [...PAGINATION_PARAMS],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Batch UUID' },
            { name: 'name', type: 'string', description: 'Batch name' },
            { name: 'start_date', type: 'date | null', description: 'Start date' },
            { name: 'end_date', type: 'date | null', description: 'End date' },
            { name: 'teacher_name', type: 'string | null', description: 'Assigned teacher name' },
            { name: 'student_count', type: 'integer', description: 'Number of enrolled students' },
            { name: 'course_count', type: 'integer', description: 'Number of assigned courses' },
            { name: 'status', type: 'string', description: 'Computed: upcoming, active, or completed' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: {
            data: [
              { id: '770e8400-e29b-41d4-a716-446655440002', name: 'Batch 2026-A', start_date: '2026-01-01', end_date: '2026-06-30', teacher_name: 'Prof. Kumar', student_count: 35, course_count: 4, status: 'active', created_at: '2025-12-15T08:00:00Z' },
            ],
            total: 5, page: 1, per_page: 20, total_pages: 1,
          },
        },
      },
      {
        id: 'get-batch',
        method: 'GET',
        path: '/batches/{batch_id}',
        summary: 'Get a batch by ID',
        description: 'Retrieve detailed information about a specific batch.',
        pathParams: [{ name: 'batch_id', type: 'uuid', required: true, description: 'The batch UUID' }],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Batch UUID' },
            { name: 'name', type: 'string', description: 'Batch name' },
            { name: 'start_date', type: 'date | null', description: 'Start date' },
            { name: 'end_date', type: 'date | null', description: 'End date' },
            { name: 'teacher_name', type: 'string | null', description: 'Assigned teacher name' },
            { name: 'student_count', type: 'integer', description: 'Number of enrolled students' },
            { name: 'course_count', type: 'integer', description: 'Number of assigned courses' },
            { name: 'status', type: 'string', description: 'Computed: upcoming, active, or completed' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: { id: '770e8400-e29b-41d4-a716-446655440002', name: 'Batch 2026-A', start_date: '2026-01-01', end_date: '2026-06-30', teacher_name: 'Prof. Kumar', student_count: 35, course_count: 4, status: 'active', created_at: '2025-12-15T08:00:00Z' },
        },
      },
    ],
  },
  {
    name: 'Courses',
    description: 'Retrieve course and curriculum information.',
    endpoints: [
      {
        id: 'list-courses',
        method: 'GET',
        path: '/courses',
        summary: 'List all courses',
        description: 'Retrieve a paginated list of courses.',
        queryParams: [...PAGINATION_PARAMS],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Course UUID' },
            { name: 'title', type: 'string', description: 'Course title' },
            { name: 'description', type: 'string | null', description: 'Course description' },
            { name: 'status', type: 'string', description: 'Course status (draft, published)' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: {
            data: [
              { id: '880e8400-e29b-41d4-a716-446655440003', title: 'Web Development Fundamentals', description: 'Learn HTML, CSS, and JavaScript', status: 'published', created_at: '2026-01-10T09:00:00Z' },
            ],
            total: 8, page: 1, per_page: 20, total_pages: 1,
          },
        },
      },
      {
        id: 'get-course',
        method: 'GET',
        path: '/courses/{course_id}',
        summary: 'Get a course with modules',
        description: 'Retrieve course details including all curriculum modules ordered by sequence.',
        pathParams: [{ name: 'course_id', type: 'uuid', required: true, description: 'The course UUID' }],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Course UUID' },
            { name: 'title', type: 'string', description: 'Course title' },
            { name: 'description', type: 'string | null', description: 'Course description' },
            { name: 'status', type: 'string', description: 'Course status' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
            { name: 'modules', type: 'Module[]', description: 'Ordered list of curriculum modules' },
          ],
          example: {
            id: '880e8400-e29b-41d4-a716-446655440003', title: 'Web Development Fundamentals', description: 'Learn HTML, CSS, and JavaScript', status: 'published', created_at: '2026-01-10T09:00:00Z',
            modules: [
              { id: '990e8400-e29b-41d4-a716-446655440004', title: 'Introduction to HTML', order: 1 },
              { id: '990e8400-e29b-41d4-a716-446655440005', title: 'CSS Styling', order: 2 },
            ],
          },
        },
      },
    ],
  },
  {
    name: 'Enrollments',
    description: 'Manage student-batch enrollment records.',
    endpoints: [
      {
        id: 'list-enrollments',
        method: 'GET',
        path: '/enrollments',
        summary: 'List enrollments',
        description: 'Retrieve a paginated list of active enrollments. Filter by batch or student.',
        queryParams: [
          ...PAGINATION_PARAMS,
          { name: 'batch_id', type: 'uuid', required: false, description: 'Filter by batch UUID' },
          { name: 'student_id', type: 'uuid', required: false, description: 'Filter by student UUID' },
        ],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Enrollment UUID' },
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string', description: 'Student full name' },
            { name: 'student_email', type: 'string', description: 'Student email' },
            { name: 'batch_id', type: 'uuid', description: 'Batch UUID' },
            { name: 'batch_name', type: 'string', description: 'Batch name' },
            { name: 'enrolled_at', type: 'datetime', description: 'Enrollment timestamp' },
          ],
          example: {
            data: [
              { id: 'aa0e8400-e29b-41d4-a716-446655440006', student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', student_email: 'john@example.com', batch_id: '770e8400-e29b-41d4-a716-446655440002', batch_name: 'Batch 2026-A', enrolled_at: '2026-01-16T12:00:00Z' },
            ],
            total: 120, page: 1, per_page: 20, total_pages: 6,
          },
        },
      },
      {
        id: 'create-enrollment',
        method: 'POST',
        path: '/enrollments',
        summary: 'Enroll a student in a batch',
        description: 'Create a new enrollment, linking a student to a batch.',
        requestBody: {
          fields: [
            { name: 'student_id', type: 'uuid', description: 'Student UUID', required: true },
            { name: 'batch_id', type: 'uuid', description: 'Batch UUID', required: true },
          ],
          example: { student_id: '550e8400-e29b-41d4-a716-446655440000', batch_id: '770e8400-e29b-41d4-a716-446655440002' },
        },
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Enrollment UUID' },
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string', description: 'Student full name' },
            { name: 'student_email', type: 'string', description: 'Student email' },
            { name: 'batch_id', type: 'uuid', description: 'Batch UUID' },
            { name: 'batch_name', type: 'string', description: 'Batch name' },
            { name: 'enrolled_at', type: 'datetime', description: 'Enrollment timestamp' },
          ],
          example: { id: 'bb0e8400-e29b-41d4-a716-446655440007', student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', student_email: 'john@example.com', batch_id: '770e8400-e29b-41d4-a716-446655440002', batch_name: 'Batch 2026-A', enrolled_at: '2026-03-11T10:30:00Z' },
        },
        webhookEvent: 'enrollment.created',
      },
      {
        id: 'remove-enrollment',
        method: 'DELETE',
        path: '/enrollments',
        summary: 'Remove an enrollment',
        description: 'Remove a student from a batch. The request body must specify both student and batch.',
        requestBody: {
          fields: [
            { name: 'student_id', type: 'uuid', description: 'Student UUID', required: true },
            { name: 'batch_id', type: 'uuid', description: 'Batch UUID', required: true },
          ],
          example: { student_id: '550e8400-e29b-41d4-a716-446655440000', batch_id: '770e8400-e29b-41d4-a716-446655440002' },
        },
        responseSchema: {
          fields: [],
          example: {},
        },
        webhookEvent: 'enrollment.removed',
      },
    ],
  },
  {
    name: 'Certificates',
    description: 'Manage student certificates: list, approve, and revoke.',
    endpoints: [
      {
        id: 'list-certificates',
        method: 'GET',
        path: '/certificates',
        summary: 'List certificates',
        description: 'Retrieve a paginated list of certificates. Filter by batch, course, or status.',
        queryParams: [
          ...PAGINATION_PARAMS,
          { name: 'batch_id', type: 'uuid', required: false, description: 'Filter by batch UUID' },
          { name: 'course_id', type: 'uuid', required: false, description: 'Filter by course UUID' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: requested, approved, issued, revoked' },
        ],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Certificate record UUID' },
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string | null', description: 'Student name' },
            { name: 'certificate_id', type: 'string | null', description: 'Formatted certificate ID (e.g. ICT-2026-0001)' },
            { name: 'verification_code', type: 'string | null', description: 'Public verification code' },
            { name: 'status', type: 'string', description: 'Certificate status' },
            { name: 'completion_percentage', type: 'number | null', description: 'Course completion percentage' },
            { name: 'issued_at', type: 'datetime | null', description: 'Issue timestamp' },
          ],
          example: {
            data: [
              { id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', certificate_id: 'ICT-2026-0001', verification_code: 'VRF-ABC123', status: 'approved', completion_percentage: 100, issued_at: '2026-02-28T14:00:00Z' },
            ],
            total: 15, page: 1, per_page: 20, total_pages: 1,
          },
        },
      },
      {
        id: 'approve-certificate',
        method: 'POST',
        path: '/certificates/{cert_id}/approve',
        summary: 'Approve a certificate',
        description: 'Approve a pending certificate request. Generates the certificate ID and PDF.',
        pathParams: [{ name: 'cert_id', type: 'uuid', required: true, description: 'The certificate record UUID' }],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Certificate record UUID' },
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string | null', description: 'Student name' },
            { name: 'certificate_id', type: 'string | null', description: 'Formatted certificate ID' },
            { name: 'verification_code', type: 'string | null', description: 'Public verification code' },
            { name: 'status', type: 'string', description: 'Certificate status (now "approved")' },
            { name: 'completion_percentage', type: 'number | null', description: 'Course completion percentage' },
            { name: 'issued_at', type: 'datetime | null', description: 'Issue timestamp' },
          ],
          example: { id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', certificate_id: 'ICT-2026-0002', verification_code: 'VRF-DEF456', status: 'approved', completion_percentage: 100, issued_at: '2026-03-11T10:30:00Z' },
        },
        webhookEvent: 'certificate.approved',
      },
      {
        id: 'revoke-certificate',
        method: 'POST',
        path: '/certificates/{cert_id}/revoke',
        summary: 'Revoke a certificate',
        description: 'Revoke a previously approved certificate. Only approved certificates can be revoked.',
        pathParams: [{ name: 'cert_id', type: 'uuid', required: true, description: 'The certificate record UUID' }],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Certificate record UUID' },
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string | null', description: 'Student name' },
            { name: 'certificate_id', type: 'string | null', description: 'Formatted certificate ID' },
            { name: 'verification_code', type: 'string | null', description: 'Public verification code' },
            { name: 'status', type: 'string', description: 'Certificate status (now "revoked")' },
            { name: 'completion_percentage', type: 'number | null', description: 'Course completion percentage' },
            { name: 'issued_at', type: 'datetime | null', description: 'Issue timestamp' },
          ],
          example: { id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', certificate_id: 'ICT-2026-0001', verification_code: 'VRF-ABC123', status: 'revoked', completion_percentage: 100, issued_at: '2026-02-28T14:00:00Z' },
        },
        webhookEvent: 'certificate.revoked',
      },
    ],
  },
  {
    name: 'Classes',
    description: 'Retrieve class schedules and attendance records.',
    endpoints: [
      {
        id: 'list-classes',
        method: 'GET',
        path: '/classes',
        summary: 'List classes',
        description: 'Retrieve a paginated list of scheduled classes. Filter by batch or status.',
        queryParams: [
          ...PAGINATION_PARAMS,
          { name: 'batch_id', type: 'uuid', required: false, description: 'Filter by batch UUID' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status: scheduled, started, ended, cancelled' },
        ],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Class UUID' },
            { name: 'batch_id', type: 'uuid', description: 'Batch UUID' },
            { name: 'title', type: 'string', description: 'Class title' },
            { name: 'scheduled_date', type: 'date | null', description: 'Scheduled date' },
            { name: 'scheduled_time', type: 'string | null', description: 'Scheduled time (HH:MM:SS)' },
            { name: 'duration', type: 'integer | null', description: 'Duration in minutes' },
            { name: 'status', type: 'string', description: 'Class status' },
            { name: 'zoom_meeting_url', type: 'string | null', description: 'Zoom meeting URL' },
          ],
          example: {
            data: [
              { id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002', title: 'HTML Basics - Session 1', scheduled_date: '2026-03-12', scheduled_time: '10:00:00', duration: 60, status: 'scheduled', zoom_meeting_url: null },
            ],
            total: 25, page: 1, per_page: 20, total_pages: 2,
          },
        },
      },
      {
        id: 'get-attendance',
        method: 'GET',
        path: '/classes/{class_id}/attendance',
        summary: 'Get class attendance',
        description: 'Retrieve attendance records for a specific class. Returns a flat array (not paginated).',
        pathParams: [{ name: 'class_id', type: 'uuid', required: true, description: 'The class UUID' }],
        responseSchema: {
          fields: [
            { name: 'student_id', type: 'uuid', description: 'Student UUID' },
            { name: 'student_name', type: 'string', description: 'Student name' },
            { name: 'attended', type: 'boolean', description: 'Whether student attended' },
            { name: 'duration_minutes', type: 'integer | null', description: 'Minutes attended' },
          ],
          example: [
            { student_id: '550e8400-e29b-41d4-a716-446655440000', student_name: 'John Doe', attended: true, duration_minutes: 55 },
            { student_id: '660e8400-e29b-41d4-a716-446655440001', student_name: 'Jane Smith', attended: false, duration_minutes: null },
          ],
        },
      },
    ],
  },
  {
    name: 'Announcements',
    description: 'List and create announcements.',
    endpoints: [
      {
        id: 'list-announcements',
        method: 'GET',
        path: '/announcements',
        summary: 'List announcements',
        description: 'Retrieve a paginated list of announcements.',
        queryParams: [...PAGINATION_PARAMS],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Announcement UUID' },
            { name: 'title', type: 'string', description: 'Announcement title' },
            { name: 'content', type: 'string', description: 'Announcement body text' },
            { name: 'scope', type: 'string', description: 'Scope: all, batch, course' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: {
            data: [
              { id: 'ee0e8400-e29b-41d4-a716-44665544000a', title: 'Holiday Notice', content: 'No classes on March 14th.', scope: 'all', created_at: '2026-03-10T08:00:00Z' },
            ],
            total: 3, page: 1, per_page: 20, total_pages: 1,
          },
        },
      },
      {
        id: 'create-announcement',
        method: 'POST',
        path: '/announcements',
        summary: 'Create an announcement',
        description: 'Post a new announcement. Set scope to "batch" or "course" and provide the corresponding ID to target specific groups.',
        requestBody: {
          fields: [
            { name: 'title', type: 'string', description: 'Announcement title', required: true },
            { name: 'content', type: 'string', description: 'Announcement body text', required: true },
            { name: 'scope', type: 'string', description: 'Scope: all, batch, or course', required: true },
            { name: 'batch_id', type: 'uuid | null', description: 'Target batch (required when scope=batch)' },
            { name: 'course_id', type: 'uuid | null', description: 'Target course (required when scope=course)' },
          ],
          example: { title: 'New Schedule Update', content: 'Classes will now start at 9 AM.', scope: 'all' },
        },
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Announcement UUID' },
            { name: 'title', type: 'string', description: 'Announcement title' },
            { name: 'content', type: 'string', description: 'Announcement body text' },
            { name: 'scope', type: 'string', description: 'Scope' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: { id: 'ff0e8400-e29b-41d4-a716-44665544000b', title: 'New Schedule Update', content: 'Classes will now start at 9 AM.', scope: 'all', created_at: '2026-03-11T10:30:00Z' },
        },
      },
    ],
  },
  {
    name: 'Jobs',
    description: 'Retrieve job postings.',
    endpoints: [
      {
        id: 'list-jobs',
        method: 'GET',
        path: '/jobs',
        summary: 'List job postings',
        description: 'Retrieve a paginated list of job postings.',
        queryParams: [...PAGINATION_PARAMS],
        responseSchema: {
          fields: [
            { name: 'id', type: 'uuid', description: 'Job UUID' },
            { name: 'title', type: 'string', description: 'Job title' },
            { name: 'company', type: 'string | null', description: 'Company name' },
            { name: 'location', type: 'string | null', description: 'Job location' },
            { name: 'job_type', type: 'string | null', description: 'Type: full-time, part-time, internship, contract' },
            { name: 'salary', type: 'string | null', description: 'Salary range' },
            { name: 'description', type: 'string | null', description: 'Job description' },
            { name: 'deadline', type: 'datetime | null', description: 'Application deadline' },
            { name: 'created_at', type: 'datetime', description: 'Creation timestamp' },
          ],
          example: {
            data: [
              { id: '110e8400-e29b-41d4-a716-44665544000c', title: 'Junior Web Developer', company: 'TechCorp', location: 'Bangalore', job_type: 'full-time', salary: '5-8 LPA', description: 'Looking for a junior web developer...', deadline: '2026-04-30T23:59:59Z', created_at: '2026-03-01T09:00:00Z' },
            ],
            total: 10, page: 1, per_page: 20, total_pages: 1,
          },
        },
      },
    ],
  },
];

// ── Webhook Event Definitions ───────────────────────────────

export const WEBHOOK_EVENT_GROUPS: WebhookEventGroup[] = [
  {
    name: 'Student Lifecycle',
    events: [
      { event: 'user.created', description: 'A new student account was created', examplePayload: { event: 'user.created', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com', name: 'John Doe', role: 'student' } } },
      { event: 'user.updated', description: 'A student profile was updated', examplePayload: { event: 'user.updated', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com', name: 'John Doe', fields_updated: ['name', 'phone'] } } },
      { event: 'user.deactivated', description: 'A student account was deactivated', examplePayload: { event: 'user.deactivated', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com' } } },
      { event: 'user.deleted', description: 'A student account was soft-deleted', examplePayload: { event: 'user.deleted', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com' } } },
    ],
  },
  {
    name: 'Enrollment',
    events: [
      { event: 'enrollment.created', description: 'A student was enrolled in a batch', examplePayload: { event: 'enrollment.created', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { student_id: '550e8400-e29b-41d4-a716-446655440000', batch_id: '770e8400-e29b-41d4-a716-446655440002' } } },
      { event: 'enrollment.removed', description: 'A student was removed from a batch', examplePayload: { event: 'enrollment.removed', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { student_id: '550e8400-e29b-41d4-a716-446655440000', batch_id: '770e8400-e29b-41d4-a716-446655440002' } } },
    ],
  },
  {
    name: 'Certificates & Progress',
    events: [
      { event: 'certificate.requested', description: 'A student requested a certificate', examplePayload: { event: 'certificate.requested', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { certificate_id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000' } } },
      { event: 'certificate.approved', description: 'A certificate was approved', examplePayload: { event: 'certificate.approved', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { certificate_id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000' } } },
      { event: 'certificate.issued', description: 'A certificate PDF was generated and issued', examplePayload: { event: 'certificate.issued', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { certificate_id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000', certificate_number: 'ICT-2026-0001' } } },
      { event: 'certificate.revoked', description: 'A certificate was revoked', examplePayload: { event: 'certificate.revoked', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { certificate_id: 'cc0e8400-e29b-41d4-a716-446655440008', student_id: '550e8400-e29b-41d4-a716-446655440000' } } },
      { event: 'lecture.progress_updated', description: 'A student\'s lecture progress changed', examplePayload: { event: 'lecture.progress_updated', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { student_id: '550e8400-e29b-41d4-a716-446655440000', lecture_id: 'aa0e8400-e29b-41d4-a716-446655440006', progress: 75 } } },
    ],
  },
  {
    name: 'Classes & Attendance',
    events: [
      { event: 'class.scheduled', description: 'A new class was scheduled', examplePayload: { event: 'class.scheduled', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { class_id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002', title: 'HTML Basics', scheduled_date: '2026-03-12' } } },
      { event: 'class.started', description: 'A class session started', examplePayload: { event: 'class.started', timestamp: '2026-03-12T10:00:00.000000+00:00', data: { class_id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002' } } },
      { event: 'class.ended', description: 'A class session ended', examplePayload: { event: 'class.ended', timestamp: '2026-03-12T11:00:00.000000+00:00', data: { class_id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002', duration_minutes: 60 } } },
      { event: 'attendance.recorded', description: 'Attendance was recorded for a class', examplePayload: { event: 'attendance.recorded', timestamp: '2026-03-12T11:05:00.000000+00:00', data: { class_id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002', total_students: 35, attended: 30 } } },
      { event: 'recording.ready', description: 'A class recording is available for playback', examplePayload: { event: 'recording.ready', timestamp: '2026-03-12T12:00:00.000000+00:00', data: { class_id: 'dd0e8400-e29b-41d4-a716-446655440009', batch_id: '770e8400-e29b-41d4-a716-446655440002' } } },
    ],
  },
];

// ── Error Codes ─────────────────────────────────────────────

export const ERROR_CODES = [
  { code: 200, description: 'OK — Request succeeded' },
  { code: 201, description: 'Created — Resource created successfully' },
  { code: 204, description: 'No Content — Resource deleted successfully' },
  { code: 400, description: 'Bad Request — Invalid parameters or request body' },
  { code: 401, description: 'Unauthorized — Missing or invalid API key' },
  { code: 403, description: 'Forbidden — API key does not have access' },
  { code: 404, description: 'Not Found — Resource does not exist' },
  { code: 429, description: 'Too Many Requests — Rate limit exceeded (1000/min)' },
  { code: 500, description: 'Internal Server Error — Something went wrong' },
];

// ── Code Example Generators ─────────────────────────────────

function buildPathWithParams(path: string): string {
  return path.replace(/\{(\w+)\}/g, (_, name) => `{${name}}`);
}

export function generateCurlExample(endpoint: EndpointDef, baseUrl: string): string {
  const fullPath = `${baseUrl}/api/v1/public${endpoint.path}`;
  const lines: string[] = [];

  if (endpoint.method === 'GET') {
    lines.push(`curl -X GET "${fullPath}" \\`);
    lines.push(`  -H "X-API-Key: your-api-key-here"`);
  } else if (endpoint.method === 'DELETE' && endpoint.requestBody) {
    lines.push(`curl -X DELETE "${fullPath}" \\`);
    lines.push(`  -H "X-API-Key: your-api-key-here" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(endpoint.requestBody.example)}'`);
  } else if (endpoint.method === 'POST' || endpoint.method === 'PATCH') {
    lines.push(`curl -X ${endpoint.method} "${fullPath}" \\`);
    lines.push(`  -H "X-API-Key: your-api-key-here" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(endpoint.requestBody?.example || {}, null, 2)}'`);
  }

  return lines.join('\n');
}

export function generatePythonExample(endpoint: EndpointDef, baseUrl: string): string {
  const fullPath = `${baseUrl}/api/v1/public${endpoint.path}`;
  const lines: string[] = ['import requests', ''];

  lines.push(`url = "${fullPath}"`);
  lines.push(`headers = {"X-API-Key": "your-api-key-here"}`);

  if (endpoint.method === 'GET') {
    lines.push('');
    lines.push('response = requests.get(url, headers=headers)');
  } else if (endpoint.method === 'DELETE' && endpoint.requestBody) {
    lines.push(`payload = ${JSON.stringify(endpoint.requestBody.example, null, 2)}`);
    lines.push('');
    lines.push('response = requests.delete(url, headers=headers, json=payload)');
  } else if (endpoint.method === 'POST' || endpoint.method === 'PATCH') {
    lines.push(`payload = ${JSON.stringify(endpoint.requestBody?.example || {}, null, 2)}`);
    lines.push('');
    lines.push(`response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)`);
  }

  lines.push('print(response.status_code)');
  lines.push('print(response.json())');
  return lines.join('\n');
}

export function generateNodeExample(endpoint: EndpointDef, baseUrl: string): string {
  const fullPath = `${baseUrl}/api/v1/public${endpoint.path}`;
  const lines: string[] = [];

  const hasBody = (endpoint.method === 'POST' || endpoint.method === 'PATCH' || (endpoint.method === 'DELETE' && endpoint.requestBody));
  const bodyStr = hasBody ? JSON.stringify(endpoint.requestBody?.example || {}, null, 2) : null;

  lines.push(`const response = await fetch("${fullPath}", {`);
  lines.push(`  method: "${endpoint.method}",`);
  lines.push(`  headers: {`);
  lines.push(`    "X-API-Key": "your-api-key-here",`);
  if (hasBody) {
    lines.push(`    "Content-Type": "application/json",`);
  }
  lines.push(`  },`);
  if (hasBody && bodyStr) {
    lines.push(`  body: JSON.stringify(${bodyStr}),`);
  }
  lines.push(`});`);
  lines.push('');
  lines.push('const data = await response.json();');
  lines.push('console.log(data);');

  return lines.join('\n');
}

// ── Flat Endpoint List Helper ───────────────────────────────

export function getAllEndpoints(): EndpointDef[] {
  return ENDPOINT_GROUPS.flatMap(g => g.endpoints);
}
