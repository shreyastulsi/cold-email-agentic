import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

type InfiniteSliderProps = {
  speed?: number;
  speedOnHover?: number;
  gap?: number;
  children: React.ReactNode;
};

export function InfiniteSlider({ speed = 40, speedOnHover = 20, gap = 64, children }: InfiniteSliderProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.offsetWidth);
    }
  }, [children]);

  const duration = contentWidth / speed;
  const hoverDuration = contentWidth / speedOnHover;

  return (
    <div className="overflow-hidden relative w-full">
      <motion.div
        className="flex"
        animate={{
          x: -contentWidth,
        }}
        transition={{
          repeat: Infinity,
          repeatType: "loop",
          duration: duration,
          ease: "linear",
        }}
        whileHover={{
          transition: {
            repeat: Infinity,
            repeatType: "loop",
            duration: hoverDuration,
            ease: "linear",
          },
        }}
      >
        <div 
          ref={contentRef}
          className="flex items-center shrink-0" 
          style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
        >
          {children}
        </div>
        <div 
          className="flex items-center shrink-0" 
          style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
