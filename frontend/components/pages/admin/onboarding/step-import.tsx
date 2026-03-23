'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import CsvImportPanel from '@/components/shared/csv-import-panel';

interface StepImportProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function StepImport({ onNext, onSkip }: StepImportProps) {
  const [imported, setImported] = useState(false);

  const handleSuccess = () => {
    setImported(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Users size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Import Students</h2>
          <p className="text-sm text-gray-500">
            Upload a CSV file to bulk-add students to your institute
          </p>
        </div>
      </div>

      <CsvImportPanel onSuccess={handleSuccess} />

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Skip this step
        </button>
        {imported && (
          <button
            onClick={onNext}
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
