'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { isPhoneValid } from '@/lib/phone';
import { checkEmailAvailability } from '@/lib/api/public';
import 'react-international-phone/style.css';
import './phone-input-overrides.css';

interface StepAboutProps {
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNext: () => void;
}

type EmailStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken'; message: string }
  | { state: 'invalid'; message: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StepAbout({
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onNext,
}: StepAboutProps) {
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ state: 'idle' });

  const trimmedEmail = email.trim().toLowerCase();
  const emailFormatOk = EMAIL_REGEX.test(trimmedEmail);
  const phoneOk = isPhoneValid(phone);

  // Debounced availability check — only runs once the email looks well-formed.
  useEffect(() => {
    if (!emailFormatOk) {
      setEmailStatus(
        emailTouched && trimmedEmail.length > 0
          ? { state: 'invalid', message: 'Please enter a valid email address' }
          : { state: 'idle' },
      );
      return;
    }

    let cancelled = false;
    setEmailStatus({ state: 'checking' });
    const timer = setTimeout(() => {
      checkEmailAvailability(trimmedEmail)
        .then((res) => {
          if (cancelled) return;
          if (res.available) {
            setEmailStatus({ state: 'available' });
          } else {
            setEmailStatus({
              state: 'taken',
              message:
                res.message || 'An account with this email already exists',
            });
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Fail-open: network errors shouldn't block signup.
          setEmailStatus({ state: 'idle' });
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedEmail, emailFormatOk, emailTouched]);

  const canContinue =
    name.trim().length > 1 &&
    emailFormatOk &&
    emailStatus.state !== 'taken' &&
    emailStatus.state !== 'checking' &&
    phoneOk;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zen-dark">About You</h2>
        <p className="text-sm text-gray-500 mt-1">
          We&apos;ll use this to set up your admin account.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="John Doe"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@example.com"
          autoComplete="email"
          className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-colors bg-gray-50 ${
            emailTouched && (emailStatus.state === 'invalid' || emailStatus.state === 'taken')
              ? 'border-red-400 focus:border-red-500'
              : emailStatus.state === 'available'
                ? 'border-emerald-400 focus:border-emerald-500'
                : 'border-gray-200 focus:border-zen-purple'
          }`}
        />
        <EmailHint status={emailStatus} visible={emailTouched} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Phone</label>
        <PhoneInput
          defaultCountry="pk"
          value={phone}
          onChange={(value) => onPhoneChange(value)}
          onBlur={() => setPhoneTouched(true)}
          inputClassName="sp-phone-input"
          countrySelectorStyleProps={{
            buttonClassName: 'sp-phone-country-btn',
            dropdownStyleProps: { className: 'sp-phone-dropdown' },
          }}
          preferredCountries={['pk', 'ae', 'sa', 'gb', 'us', 'in']}
          inputProps={{ autoComplete: 'tel' }}
        />
        {phoneTouched && !phoneOk && phone.trim().length > 3 && (
          <p className="mt-1.5 text-xs text-red-500">
            Please enter a valid phone number for the selected country.
          </p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function EmailHint({ status, visible }: { status: EmailStatus; visible: boolean }) {
  if (!visible) return null;
  if (status.state === 'checking') {
    return (
      <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
        <Loader2 size={12} className="animate-spin" />
        Checking availability…
      </p>
    );
  }
  if (status.state === 'available') {
    return <p className="mt-1.5 text-xs text-emerald-600">Looks good — this email is available.</p>;
  }
  if (status.state === 'taken') {
    return (
      <p className="mt-1.5 text-xs text-red-500">
        {status.message}.{' '}
        <a href="/login" className="underline font-medium">
          Sign in instead
        </a>
        .
      </p>
    );
  }
  if (status.state === 'invalid') {
    return <p className="mt-1.5 text-xs text-red-500">{status.message}</p>;
  }
  return null;
}
