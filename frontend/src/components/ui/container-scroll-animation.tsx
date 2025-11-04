"use client";
import {
  animate,
  motion,
  MotionValue,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import React, { useEffect, useRef } from "react";

export const ContainerScroll = ({
  titleComponent,
  children,
  animationDuration = 1.2,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
  animationDuration?: number;
}) => {
  const containerRef = useRef<any>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());

  const scrollTranslate = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const cardOnLoadTranslateY = useMotionValue(100);
  const headerOnLoadTranslateY = useMotionValue(-100);
  const onLoadOpacity = useMotionValue(0);

  useEffect(() => {
    animate(cardOnLoadTranslateY, 0, {
      duration: animationDuration,
      ease: [0.16, 1, 0.3, 1],
    });
    animate(headerOnLoadTranslateY, 0, {
      duration: animationDuration,
      ease: [0.16, 1, 0.3, 1],
    });
    animate(onLoadOpacity, 1, {
      duration: animationDuration,
      ease: [0.16, 1, 0.3, 1],
    });
  }, [animationDuration]);

  const cardTranslateY = useTransform(
    [scrollTranslate, cardOnLoadTranslateY],
    ([scroll, onload]) => Number(scroll) + Number(onload)
  );

  const headerTranslateY = useTransform(
    [scrollTranslate, headerOnLoadTranslateY],
    ([scroll, onload]) => Number(scroll) + Number(onload)
  );

  return (
    <div
      className="h-[60rem] flex items-center justify-center relative p-20"
      ref={containerRef}
    >
      <div
        className="py-40 w-full relative"
        style={{
          perspective: "1000px",
        }}
      >
        <Header
          translate={headerTranslateY}
          titleComponent={titleComponent}
          opacity={onLoadOpacity}
        />
        <Card
          rotate={rotate}
          translate={cardTranslateY}
          scale={scale}
          opacity={onLoadOpacity}
        >
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent, opacity }: any) => {
  return (
    <motion.div
      style={{
        translateY: translate,
        opacity: opacity,
      }}
      className="div max-w-5xl mx-auto text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  translate,
  opacity,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  opacity: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        translateY: translate,
        opacity,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-5xl -mt-3.5 mx-auto h-[30rem] w-full border-4 border-[#6C6C6C] p-6 bg-[#222222] rounded-[30px] shadow-2xl"
    >
      <div className="h-full w-full rounded-2xl overflow-hidden">
        {children}
      </div>
    </motion.div>
  );
};
