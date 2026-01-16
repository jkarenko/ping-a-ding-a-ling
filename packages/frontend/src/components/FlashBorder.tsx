import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/session.store';

interface FlashBorderProps {
  children: React.ReactNode;
  className?: string;
}

const FLASH_CLASSES: Record<string, string> = {
  latency_spike: 'flash-border-latency',
  packet_loss: 'flash-border-loss',
  jitter: 'flash-border-jitter',
};

export function FlashBorder({ children, className = '' }: FlashBorderProps) {
  const { flashKey, flashType } = useSessionStore();
  const [isFlashing, setIsFlashing] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentFlashClass, setCurrentFlashClass] = useState('');

  useEffect(() => {
    if (flashKey > 0 && flashType) {
      // Reset animation by forcing a re-render with new key
      setAnimationKey((k) => k + 1);
      setCurrentFlashClass(FLASH_CLASSES[flashType] || '');
      setIsFlashing(true);

      // Clear flashing state after animation completes
      const timeout = setTimeout(() => {
        setIsFlashing(false);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [flashKey, flashType]);

  return (
    <div
      key={animationKey}
      className={`
        rounded-lg transition-shadow
        ${isFlashing ? currentFlashClass : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
