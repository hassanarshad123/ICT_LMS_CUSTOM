'use client';

interface ZensbotBadgeProps {
  variant?: 'light' | 'dark' | 'minimal';
  className?: string;
}

function ZensbotLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Z letter stylized as a bolt/lightning - represents Zensbot's speed & tech */}
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M7 7H17L10 12.5H17L7 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ZensbotBadge({ variant = 'light', className = '' }: ZensbotBadgeProps) {
  const styles = {
    light: {
      wrapper: 'text-gray-400 hover:text-gray-600',
      dot: 'bg-gray-300',
      label: 'text-gray-400',
      brand: 'text-gray-500 hover:text-[#1A1A1A]',
      icon: 'text-gray-400',
    },
    dark: {
      wrapper: 'text-gray-500 hover:text-gray-300',
      dot: 'bg-gray-600',
      label: 'text-gray-500',
      brand: 'text-gray-400 hover:text-white',
      icon: 'text-gray-500',
    },
    minimal: {
      wrapper: 'text-gray-400 hover:text-gray-500',
      dot: 'bg-gray-200',
      label: 'text-gray-400',
      brand: 'text-gray-500 hover:text-gray-700',
      icon: 'text-gray-400',
    },
  };

  const s = styles[variant];

  return (
    <div className={`flex items-center justify-center gap-1.5 transition-colors duration-200 ${s.wrapper} ${className}`}>
      <ZensbotLogo size={14} className={s.icon} />
      <span className={`text-[11px] tracking-wide ${s.label}`}>Built by</span>
      <a
        href="https://zensbot.com"
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[11px] font-semibold tracking-wide transition-colors duration-200 ${s.brand}`}
      >
        Zensbot.com
      </a>
    </div>
  );
}

export function ZensbotSidebarBadge() {
  return (
    <a
      href="https://zensbot.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1.5 py-2 group transition-colors duration-200"
    >
      <ZensbotLogo size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
      <span className="text-[10px] text-gray-300 group-hover:text-gray-500 tracking-wide transition-colors">
        Powered by
      </span>
      <span className="text-[10px] font-semibold text-gray-400 group-hover:text-[#1A1A1A] tracking-wide transition-colors">
        Zensbot.com
      </span>
    </a>
  );
}
