import React from 'react';

type ProgressiveBlurProps = {
  className?: string;
  direction: 'left' | 'right' | 'top' | 'bottom';
  blurIntensity?: number;
}

export function ProgressiveBlur({ className = '', direction = 'bottom', blurIntensity = 1 }: ProgressiveBlurProps) {
  const style = {
    backdropFilter: `blur(${blurIntensity}px)`,
    WebkitBackdropFilter: `blur(${blurIntensity}px)`,
    maskImage: `linear-gradient(to ${direction}, rgba(0,0,0,1), transparent)`,
    WebkitMaskImage: `-webkit-linear-gradient(to ${direction}, rgba(0,0,0,1), transparent)`,
  } as React.CSSProperties;

  return (
    <div className={className} style={style} />
  );
}
