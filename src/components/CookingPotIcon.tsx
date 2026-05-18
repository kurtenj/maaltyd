import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";

interface CookingPotIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const LID_VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: {
    rotate: [0, -14, 14, -10, 10, -6, 6, 0],
    transition: {
      duration: 0.9,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 0.2,
    },
  },
};

const POT_VARIANTS: Variants = {
  normal: { scale: 1 },
  animate: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.95,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 0.15,
    },
  },
};

const CookingPotIcon: React.FC<CookingPotIconProps> = ({ className, size = 28, isAnimating = false, ...props }) => {
  const controls = useAnimation();

  useEffect(() => {
    if (isAnimating) {
      controls.start("animate");
    } else {
      controls.start("normal");
    }
    return () => { controls.stop(); };
  }, [isAnimating, controls]);

  return (
    <div className={className} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.g
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "12px 16px" }}
          variants={POT_VARIANTS}
        >
          <path d="M2 12h20" />
          <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
        </motion.g>
        <motion.g
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "18px 6px" }}
          variants={LID_VARIANTS}
        >
          <path d="m4 8 16-4" />
          <path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8" />
        </motion.g>
      </svg>
    </div>
  );
};

export default CookingPotIcon;
