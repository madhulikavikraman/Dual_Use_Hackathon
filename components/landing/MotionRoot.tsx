"use client";

// One motion setup for every animated island on the landing page: the small LazyMotion bundle (domAnimation, `m`
// components only, strict so a full `motion` component cannot sneak in) and reducedMotion="user", which turns
// transform animations off for people who ask their OS for less motion while keeping short opacity fades.
import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
