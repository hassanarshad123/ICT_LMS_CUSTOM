'use client';

import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

interface ZoomParallaxProps {
  items: React.ReactNode[];
}

export function ZoomParallax({ items }: ZoomParallaxProps) {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  });

  const scale3 = useTransform(scrollYProgress, [0, 1], [1, 3]);
  const scale4 = useTransform(scrollYProgress, [0, 1], [1, 4]);
  const scale5 = useTransform(scrollYProgress, [0, 1], [1, 5]);
  const scale6 = useTransform(scrollYProgress, [0, 1], [1, 6]);
  const scale7 = useTransform(scrollYProgress, [0, 1], [1, 7]);

  const scales = [scale3, scale4, scale5, scale4, scale5, scale6, scale7];

  const positionClasses = [
    '[&>div]:!h-[30vh] [&>div]:!w-[30vw]', // index 0: center (Dashboard) — bumped from default 25vh × 25vw
    '[&>div]:!-top-[30vh] [&>div]:!left-[5vw] [&>div]:!h-[30vh] [&>div]:!w-[35vw]',
    '[&>div]:!-top-[10vh] [&>div]:!-left-[25vw] [&>div]:!h-[45vh] [&>div]:!w-[20vw]',
    '[&>div]:!left-[27.5vw] [&>div]:!h-[25vh] [&>div]:!w-[25vw]',
    '[&>div]:!top-[27.5vh] [&>div]:!left-[5vw] [&>div]:!h-[25vh] [&>div]:!w-[20vw]',
    '[&>div]:!top-[27.5vh] [&>div]:!-left-[22.5vw] [&>div]:!h-[25vh] [&>div]:!w-[30vw]',
    '[&>div]:!top-[22.5vh] [&>div]:!left-[25vw] [&>div]:!h-[22vh] [&>div]:!w-[20vw]', // AI Tools — bumped from 15vh × 15vw
  ];

  return (
    <div ref={container} className="relative h-[250vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {items.slice(0, 7).map((item, index) => {
          const scale = scales[index % scales.length];

          return (
            <motion.div
              key={index}
              style={{ scale, willChange: 'transform' }}
              className={`absolute top-0 flex h-full w-full items-center justify-center ${positionClasses[index]}`}
            >
              <div className="relative h-[25vh] w-[25vw] overflow-hidden rounded-2xl shadow-2xl">
                {item}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
