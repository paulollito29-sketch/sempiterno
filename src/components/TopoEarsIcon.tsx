import React from 'react';

interface MouseEarsProps {
  type?: 'gigio' | 'rosita' | 'couple';
  className?: string;
  size?: number;
}

export const MouseEarsIcon: React.FC<MouseEarsProps> = ({
  type = 'gigio',
  className = '',
  size = 24,
}) => {
  if (type === 'rosita') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Left Ear */}
        <circle cx="8" cy="9" r="6" fill="#FFB5A7" stroke="#181B23" strokeWidth="2.5" />
        <circle cx="8" cy="9" r="3.2" fill="#FF6E61" />
        {/* Right Ear */}
        <circle cx="24" cy="9" r="6" fill="#FFB5A7" stroke="#181B23" strokeWidth="2.5" />
        <circle cx="24" cy="9" r="3.2" fill="#FF6E61" />
        {/* Head Outline */}
        <circle cx="16" cy="18" r="9" fill="#FFFDF7" stroke="#181B23" strokeWidth="2.5" />
        {/* Rosita's Bow Ribbon */}
        <path
          d="M13 11 C11 9 10 13 13 13 L19 13 C22 13 21 9 19 11 Z"
          fill="#FF6E61"
          stroke="#181B23"
          strokeWidth="1.5"
        />
        <circle cx="16" cy="12" r="2" fill="#FDE68A" stroke="#181B23" strokeWidth="1.2" />
      </svg>
    );
  }

  if (type === 'couple') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Gigio Left */}
        <circle cx="7" cy="8" r="5" fill="#FFE17D" stroke="#181B23" strokeWidth="2" />
        <circle cx="17" cy="8" r="5" fill="#FFE17D" stroke="#181B23" strokeWidth="2" />
        <circle cx="12" cy="16" r="7.5" fill="#FFFDF7" stroke="#181B23" strokeWidth="2" />
        {/* Rosita Right */}
        <circle cx="23" cy="8" r="5" fill="#FFB5A7" stroke="#181B23" strokeWidth="2" />
        <circle cx="33" cy="8" r="5" fill="#FFB5A7" stroke="#181B23" strokeWidth="2" />
        <circle cx="28" cy="16" r="7.5" fill="#FFFDF7" stroke="#181B23" strokeWidth="2" />
        {/* Heart in middle */}
        <path
          d="M20 18 C20 16 18 14 16 16 C14 18 20 22 20 22 C20 22 26 18 24 16 C22 14 20 16 20 18 Z"
          fill="#FF6E61"
          stroke="#181B23"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  // Gigio default with nightcap / cute ears
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left Ear */}
      <circle cx="8" cy="9" r="6" fill="#FDE68A" stroke="#181B23" strokeWidth="2.5" />
      <circle cx="8" cy="9" r="3.2" fill="#FFB5A7" />
      {/* Right Ear */}
      <circle cx="24" cy="9" r="6" fill="#FDE68A" stroke="#181B23" strokeWidth="2.5" />
      <circle cx="24" cy="9" r="3.2" fill="#FFB5A7" />
      {/* Head Outline */}
      <circle cx="16" cy="18" r="9" fill="#FFFDF7" stroke="#181B23" strokeWidth="2.5" />
      {/* Gigio Nightcap Stripes */}
      <path
        d="M11 12 C13 7 19 7 21 12 Z"
        fill="#FF6E61"
        stroke="#181B23"
        strokeWidth="1.5"
      />
      <circle cx="21" cy="7" r="2" fill="#FFFDF7" stroke="#181B23" strokeWidth="1.2" />
    </svg>
  );
};
