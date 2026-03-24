export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Pakistani number with country code: 923001234567 → +92 300 1234567
  if (digits.startsWith('92') && digits.length >= 12) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  // Pakistani number with leading 0: 03001234567 → +92 300 1234567
  if (digits.startsWith('0') && digits.length >= 11) {
    return `+92 ${digits.slice(1, 4)} ${digits.slice(4)}`;
  }
  // Return as-is if unrecognized format
  return phone;
}
