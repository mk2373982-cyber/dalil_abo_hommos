import React, { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import { ArrowUp } from 'lucide-react';

/** Ultra-thin GPU-accelerated top scroll progress indicator (emerald to gold) */
export const ScrollProgressBar: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 32,
    restDelta: 0.001,
  });

  if (prefersReduced) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '100% 50%' }}
      className="fixed top-0 inset-x-0 h-[3px] z-50 pointer-events-none bg-gradient-to-l from-[#0f5132] via-[#198754] to-[#cca730]"
    />
  );
};

/** Crisp, zero-latency route entrance transition for every page */
export const PageTransition: React.FC<{
  routeKey: string;
  children: React.ReactNode;
  className?: string;
}> = ({ routeKey, children, className = '' }) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      key={routeKey}
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Scroll-triggered Fade-In-Up reveal for cards, list items, and sections.
 * Uses `viewport={{ once: true, amount: 'some' }}` so tall cards never get stuck hidden,
 * caps stagger delay so long lists remain crisp, and respects OS Reduced Motion.
 */
export const FadeInUp: React.FC<{
  children: React.ReactNode;
  index?: number;
  delay?: number;
  y?: number;
  layout?: boolean;
  className?: string;
}> = ({ children, index = 0, delay, y = 20, layout = false, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const computedDelay = delay !== undefined ? delay : Math.min(index * 0.045, 0.27);

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      layout={layout}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{
        duration: 0.36,
        delay: computedDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Filterable list/grid wrapper matching the Home Page's smooth popLayout reflow.
 */
export const AnimatedListContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div layout className={className}>
      <AnimatePresence mode="popLayout">{children}</AnimatePresence>
    </motion.div>
  );
};

/**
 * Individual card inside AnimatedListContainer with forwardRef for AnimatePresence popLayout.
 * Uses the exact Home Page reveal curve (duration 0.36s, ease [0.16, 1, 0.3, 1], capped stagger).
 */
export const AnimatedListItem = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    index?: number;
    y?: number;
    className?: string;
  }
>(({ children, index = 0, y = 20, className = '' }, ref) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      layout={!prefersReduced}
      initial={prefersReduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : {
              duration: 0.36,
              delay: Math.min(index * 0.045, 0.27),
              ease: [0.16, 1, 0.3, 1],
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
});
AnimatedListItem.displayName = 'AnimatedListItem';

/** Smooth empty-state / feedback reveal matching the Home Page */
export const AnimatedEmptyState: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Tactile filter chip button with spring tap feedback matching Home Page promo chips */
export const AnimatedFilterChip: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  type?: 'button' | 'submit';
}> = ({ children, onClick, className = '', type = 'button' }) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.button
      type={type}
      whileTap={prefersReduced ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
};

/** Smooth sticky bottom action bar reveal for booking, menus, carts, and detail views */
export const AnimatedStickyBar: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Floating tactile Back-to-Top button that springs in smoothly after scrolling */
export const FloatingScrollTopButton: React.FC<{
  hasBottomBar?: boolean;
}> = ({ hasBottomBar = true }) => {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 360);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.75, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.75, y: 16 }}
          transition={
            prefersReduced
              ? { duration: 0.1 }
              : { type: 'spring', stiffness: 420, damping: 26 }
          }
          whileHover={prefersReduced ? undefined : { scale: 1.07, y: -2 }}
          whileTap={prefersReduced ? undefined : { scale: 0.92 }}
          onClick={() =>
            window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
          }
          aria-label="العودة للأعلى"
          className={`fixed left-4 z-30 w-11 h-11 rounded-full bg-[#003820]/90 hover:bg-[#0f5132] text-white border border-[#9ff1bd]/35 backdrop-blur-md shadow-civic-2 flex items-center justify-center cursor-pointer ${
            hasBottomBar ? 'bottom-24 md:bottom-6' : 'bottom-6'
          }`}
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
