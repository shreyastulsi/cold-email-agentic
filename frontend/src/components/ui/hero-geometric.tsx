"use client";

import { Button } from "@/components/ui/button";
import type { Variants } from 'framer-motion';
import { motion, useAnimation } from "framer-motion";
import { Circle } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../../libs/utils";
import { HeroHeader } from "../header";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  const controls = useAnimation();

  useEffect(() => {
    async function animateLoop() {
      while (true) {
        // Fall slowly down the screen
        await controls.start({
          y: ["0vh", `${100 + height}px`],
          opacity: [1, 1],
          transition: {
            duration: 20,
            ease: "linear",
          },
        });

        // Reset to above screen and fade in
        await controls.set({
          y: `-${height}px`,
          opacity: 0,
        });

        await controls.start({
          opacity: 1,
          transition: { duration: 0.5, ease: "easeInOut" },
        });
      }
    }

    animateLoop();
  }, [controls, height]);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={controls}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-white/[0.15]",
            "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

function HeroGeometric({
  badge = "Founders, Inc.",
  title1 = "Revolutionizing Automation",
  title2 = "For Every Single Business.",
}: {
  badge?: string;
  title1?: string;
  title2?: string;
}) {
  const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <>
      <HeroHeader />
      <section className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden bg-[#181A1B] z-0 p-0 m-0 -ml-[50vw] left-1/2 right-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] blur-3xl" />

        <div className="absolute inset-0 overflow-hidden">
          <ElegantShape
            delay={0.3}
            width={600}
            height={140}
            rotate={12}
            gradient="from-indigo-500/[0.15]"
            className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
          />
          <ElegantShape
            delay={0.5}
            width={500}
            height={120}
            rotate={-15}
            gradient="from-rose-500/[0.15]"
            className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
          />
          <ElegantShape
            delay={0.4}
            width={300}
            height={80}
            rotate={-8}
            gradient="from-violet-500/[0.15]"
            className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
          />
          <ElegantShape
            delay={0.6}
            width={200}
            height={60}
            rotate={20}
            gradient="from-amber-500/[0.15]"
            className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
          />
          <ElegantShape
            delay={0.7}
            width={150}
            height={40}
            rotate={-25}
            gradient="from-cyan-500/[0.15]"
            className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
          />
        </div>

        <div className="relative z-10 w-screen max-w-none text-center p-0 m-0">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8 md:mb-12"
            >
              <Circle className="h-2 w-2 fill-cyan-500/80" />
              <span className="text-sm text-white/60 tracking-wide">
                {badge}
              </span>
            </motion.div>

            <motion.div
              custom={1}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  {title1}
                </span>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-white/90 to-cyan-200">
                  {title2}
                </span>
              </h1>
            </motion.div>

            <motion.div
              custom={2}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <p className="text-base sm:text-lg md:text-xl text-white/70 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
                Using AI-powered fault detection to help businesses, both big and small, ship flawless products to their consumers with cost-slashing efficiency
              </p>
              <Button
                variant="default"
                size="lg"
                className="mt-2 font-semibold shadow-[0_0_12px_2px_rgba(255,255,255,0.32)]"
                onClick={() => {
                  const el = document.getElementById('waitlist-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              >
                Get Exclusive Access
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
      </section>
    </>
  );
}

export { HeroGeometric };
