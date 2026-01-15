import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/session.store';

interface FlashBorderProps {
  children: React.ReactNode;
  className?: string;
}

export function FlashBorder({ children, className = '' }: FlashBorderProps) {
  const { flashKey } = useSessionStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (flashKey > 0) {
      // Reset animation by forcing a re-render with new key
      setAnimationKey((k) => k + 1);
      setIsFlashing(true);

      // Clear flashing state after animation completes
      const timeout = setTimeout(() => {
        setIsFlashing(false);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [flashKey]);

  return (
    <div
      key={animationKey}
      className={`
        rounded-lg transition-shadow
        ${isFlashing ? 'flash-border' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
