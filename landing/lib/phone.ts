import { isValidPhoneNumber } from 'libphonenumber-js/min';

/**
 * Validate a phone number against the country's actual length + prefix rules.
 *
 * The `PhoneInput` from react-international-phone returns values in E.164
 * format (e.g. "+923001234567"). `libphonenumber-js` confirms the number is
 * both well-formed AND the correct length for the detected country.
 *
 * Returns false for partial / mid-typing values so the form's "Continue"
 * button stays disabled until the user has entered a complete number.
 */
export function isPhoneValid(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('+') || trimmed.length < 8) return false;
  try {
    return isValidPhoneNumber(trimmed);
  } catch {
    return false;
  }
}
