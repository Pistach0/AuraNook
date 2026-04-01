import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* House Outline */}
      <path 
        d="M100 20L30 80V170H170V80L100 20Z" 
        stroke="#5A7D36" 
        strokeWidth="12" 
        strokeLinejoin="round"
      />
      {/* Inner House/Door Shape */}
      <path 
        d="M70 110V170H130V90L100 60L70 90" 
        stroke="#5A7D36" 
        strokeWidth="12" 
        strokeLinejoin="round"
      />
      {/* Diagonal Line - characteristic of the provided logo */}
      <path 
        d="M30 80L100 150" 
        stroke="#5A7D36" 
        strokeWidth="12" 
        strokeLinecap="round"
      />
    </svg>
  );
};
