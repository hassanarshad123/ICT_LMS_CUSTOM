/**
 * Download a sample CSV template for bulk student import.
 */
export function downloadCsvTemplate() {
  const headers = 'name,email,phone,role,specialization';
  const rows = [
    'Ali Ahmed,ali@example.com,0300-1234567,student,',
    'Sara Khan,sara@example.com,0321-7654321,student,',
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
