'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { verifyCertificate, CertificateVerifyOut } from '@/lib/api/certificates';
import { GraduationCap, Search, CheckCircle2, XCircle, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [code, setCode] = useState(codeFromUrl);
  const [result, setResult] = useState<CertificateVerifyOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await verifyCertificate(code.trim());
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify if code comes from URL
  useState(() => {
    if (codeFromUrl) {
      handleVerify();
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1A1A1A] text-white">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <GraduationCap size={24} className="text-[#C5D86D]" />
            </div>
            <h1 className="text-2xl font-bold">ICT Institute</h1>
          </div>
          <p className="text-gray-400 text-sm">Certificate Verification Portal</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Search Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-1">Verify Certificate</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter the verification code from the certificate to verify its authenticity.
          </p>
          <form onSubmit={handleVerify} className="flex gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter verification code"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Verify
            </button>
          </form>
        </div>

        {/* Result */}
        {loading && (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <Loader2 size={32} className="animate-spin text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Verifying certificate...</p>
          </div>
        )}

        {!loading && searched && result && result.valid && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <ShieldCheck size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-700">Valid Certificate</h3>
                <p className="text-sm text-green-600">This certificate has been verified and is authentic.</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Name on Certificate</p>
                <p className="text-lg font-semibold text-[#1A1A1A]">{result.certificateName || result.studentName}</p>
                {result.certificateName && result.certificateName !== result.studentName && (
                  <p className="text-xs text-gray-400 mt-0.5">Account name: {result.studentName}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Course</p>
                <p className="text-base font-medium text-[#1A1A1A]">{result.courseTitle}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Batch</p>
                  <p className="text-sm text-[#1A1A1A]">{result.batchName}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Date Issued</p>
                  <p className="text-sm text-[#1A1A1A]">
                    {result.issuedAt ? new Date(result.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Certificate ID</p>
                <p className="text-sm font-mono text-[#1A1A1A]">{result.certificateId}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && searched && result && result.status === 'revoked' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-700">Certificate Revoked</h3>
                <p className="text-sm text-amber-600">This certificate was found but has been revoked.</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Name on Certificate</p>
                <p className="text-lg font-semibold text-[#1A1A1A]">{result.certificateName || result.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Course</p>
                <p className="text-base font-medium text-[#1A1A1A]">{result.courseTitle}</p>
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Certificate ID</p>
                <p className="text-sm font-mono text-[#1A1A1A]">{result.certificateId}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && searched && (!result || (!result.valid && result.status !== 'revoked')) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <XCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Certificate Not Found</h3>
                <p className="text-sm text-red-500">
                  No certificate was found with this verification code. Please check the code and try again.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
