'use client';

interface LmsPreviewProps {
  instituteName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoPreview: string | null;
  tagline: string;
}

export function LmsPreview({
  instituteName,
  primaryColor,
  accentColor,
  backgroundColor,
  logoPreview,
  tagline,
}: LmsPreviewProps) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Preview</p>
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Top bar */}
        <div
          className="h-10 flex items-center px-3 gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {logoPreview ? (
            <img src={logoPreview} alt="" className="w-6 h-6 rounded object-contain" />
          ) : (
            <div className="w-6 h-6 rounded bg-white/20" />
          )}
          <span className="text-xs font-medium text-white truncate flex-1">
            {instituteName || 'Your Institute'}
          </span>
          <div className="w-6 h-6 rounded-full bg-white/20 shrink-0" />
        </div>

        {/* Body */}
        <div className="flex">
          {/* Sidebar */}
          <div
            className="w-12 min-h-[200px] flex flex-col items-center py-4 gap-3"
            style={{ backgroundColor: primaryColor, opacity: 0.9 }}
          >
            <div className="w-6 h-0.5 rounded bg-white/60" />
            <div className="w-6 h-0.5 rounded bg-white/30" />
            <div className="w-6 h-0.5 rounded bg-white/30" />
            <div className="w-6 h-0.5 rounded bg-white/30" />
          </div>

          {/* Main content */}
          <div className="flex-1 p-3" style={{ backgroundColor }}>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: primaryColor }}>
              Welcome back
            </p>
            <p className="text-[8px] text-gray-400 truncate mb-3">
              {tagline || 'Learning Management System'}
            </p>

            {/* Course cards */}
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg p-1.5 border border-gray-100 shadow-sm">
                  <div className="h-1 rounded mb-1.5" style={{ backgroundColor: accentColor }} />
                  <div className="h-0.5 w-10 rounded bg-gray-200 mb-1" />
                  <div className="h-0.5 w-7 rounded bg-gray-100" />
                </div>
              ))}
            </div>

            {/* Badge */}
            <div className="mt-3 flex justify-end">
              <span
                className="text-[8px] px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: accentColor }}
              >
                3 Courses
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
