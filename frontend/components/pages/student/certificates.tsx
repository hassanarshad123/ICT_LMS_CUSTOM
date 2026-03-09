'use client';

import { useApi, useMutation } from '@/hooks/use-api';
import { listCertificates, downloadCertificate, CertificateOut } from '@/lib/api/certificates';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Award, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statusBadge: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  revoked: 'bg-red-100 text-red-700',
  eligible: 'bg-yellow-100 text-yellow-700',
};

export default function StudentCertificates() {
  const { data, loading, error, refetch } = useApi(
    () => listCertificates({ per_page: 50 }),
  );

  const { execute: doDownload } = useMutation(downloadCertificate);

  const handleDownload = async (cert: CertificateOut) => {
    try {
      const res = await doDownload(cert.id);
      window.open(res.downloadUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download certificate');
    }
  };

  if (loading) return <PageLoading variant="cards" />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  const certs = data?.data || [];

  if (certs.length === 0) {
    return (
      <EmptyState
        icon={<Award size={28} className="text-gray-400" />}
        title="No Certificates Yet"
        description="Complete your courses to earn certificates. Keep watching those lectures!"
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">Download and share your course completion certificates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certs.map((cert) => (
          <div key={cert.id} className="bg-white rounded-2xl p-5 card-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center flex-shrink-0">
                <Award size={20} className="text-[#1A1A1A]" />
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge[cert.status] || 'bg-gray-100 text-gray-600'}`}>
                {cert.status}
              </span>
            </div>

            <h3 className="font-semibold text-[#1A1A1A] mb-1 line-clamp-2">{cert.courseTitle}</h3>
            <p className="text-xs text-gray-500 mb-3">{cert.batchName}</p>

            <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
              <span>ID: {cert.certificateId}</span>
              <span>
                {cert.issuedAt
                  ? new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </span>
            </div>

            {cert.status === 'approved' && (
              <button
                onClick={() => handleDownload(cert)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
              >
                <Download size={16} />
                Download PDF
              </button>
            )}

            {cert.status === 'revoked' && (
              <p className="text-xs text-red-500 text-center">
                This certificate has been revoked{cert.revocationReason ? `: ${cert.revocationReason}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
