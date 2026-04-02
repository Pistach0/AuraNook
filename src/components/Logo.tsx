import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  // Reemplaza esta URL con la ruta de tu archivo PNG propio
  const logoSrc = "https://lh3.googleusercontent.com/u/0/d/1iOFGvvtXXOg5f7ZTlZnCz8nuluA2R-xN"; 

  return (
    <img 
      src={logoSrc} 
      alt="AuraNook Logo" 
      width={size} 
      height={size} 
      className={cn("object-contain", className)} 
      referrerPolicy="no-referrer"
    />
  );
};
