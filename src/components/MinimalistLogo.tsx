import React from 'react';

interface MinimalistLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const MinimalistLogo: React.FC<MinimalistLogoProps> = ({ size = 'md' }) => {
  const dimensions =
    size === 'sm' ? 'w-10 h-10 p-2 rounded-2xl' : size === 'lg' ? 'w-20 h-20 p-4 rounded-3xl' : 'w-14 h-14 p-3 rounded-2xl';
  const iconDims = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';

  return (
    <div
      className={`${dimensions} bg-gradient-to-tr from-stone-900 to-stone-800 dark:from-stone-800 dark:to-stone-700 shadow-lg flex items-center justify-center relative overflow-hidden shrink-0`}
    >
      <div className="absolute -top-4 -right-4 w-12 h-12 bg-rose-500/25 rounded-full blur-xl pointer-events-none" />
      <svg
        className={`${iconDims} text-rose-400`}
        viewBox="0 0 100 100"
        fill="none"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="sempiternoRoseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4A5A5" />
            <stop offset="100%" stopColor="#E17068" />
          </linearGradient>
        </defs>
        <path
          d="M30 60 C 15 45, 15 25, 33 25 C 43 25, 48 35, 50 42 C 52 35, 57 25, 67 25 C 85 25, 85 45, 70 60 L 50 80 Z"
          stroke="url(#sempiternoRoseGrad)"
          fill="rgba(225, 112, 104, 0.1)"
        />
      </svg>
    </div>
  );
};
