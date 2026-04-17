/**
 * Download a sample CSV template for bulk student import.
 *
 * Columns:
 *  - name, email, phone, role, specialization, password — existing fields
 *  - access_days       — optional; N days from enrollment date (mutually exclusive with access_end_date)
 *  - access_end_date   — optional; ISO date YYYY-MM-DD (mutually exclusive with access_days)
 *
 * Leave both access_days and access_end_date blank to use the batch end date
 * as the student's access expiry (the default behaviour).
 */
export function downloadCsvTemplate() {
  const headers = 'name,email,phone,role,specialization,password,access_days,access_end_date';
  const rows = [
    // student with 30-day custom access
    'Ali Ahmed,ali@example.com,0300-1234567,student,,,30,',
    // student with a specific end date
    'Jane Doe,jane@example.com,0321-7654321,student,,,,2026-12-31',
    // student using default batch end date (both access fields left blank)
    'Hassan Raza,hassan@example.com,0333-9876543,student,,,',
    // non-student rows (access fields ignored)
    'Sara Khan,sara@example.com,0345-1111111,teacher,Mathematics,TeacherPass123,,',
    'Bilal Rao,bilal@example.com,0312-2222222,course-creator,,CCPass456,,',
  ];
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student_import_template.csv';
  link.click();
  URL.revokeObjectURL(url);
}
