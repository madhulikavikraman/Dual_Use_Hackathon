"use client";

// An ordered list whose items light up one after another the first time it scrolls into view (stagger 0.08 s,
// once). Used for the ladder, where the order is the point: watch, ask, slow, hold, hand to a person. The items are
// rendered on the server and passed in as children; reduced motion keeps only the fade.
import { Children, type ReactNode } from "react";
import { m } from "motion/react";
import { MotionRoot } from "./MotionRoot";
import { motionTokens as T } from "./motion";

const list = { hidden: {}, shown: { transition: { staggerChildren: T.stagger } } };
const item = {
  hidden: { opacity: 0, x: -T.distance.md },
  shown: { opacity: 1, x: 0, transition: { duration: T.duration.slow, ease: T.easing.smooth } },
};

export function RevealList({ children, className = "", itemClassName = "" }: { children: ReactNode; className?: string; itemClassName?: string }) {
  return (
    <MotionRoot>
      <m.ol className={className} variants={list} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.15 }}>
        {Children.toArray(children).map((child, i) => (
          <m.li key={i} className={itemClassName} variants={item}>
            {child}
          </m.li>
        ))}
      </m.ol>
    </MotionRoot>
  );
}
