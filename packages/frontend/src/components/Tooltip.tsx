import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ vertical: 'top' | 'bottom'; horizontal: 'left' | 'center' | 'right' }>({ vertical: 'bottom', horizontal: 'center' });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;

      // Prefer bottom, use top only if more space above
      const vertical = spaceBelow < 150 && spaceAbove > spaceBelow ? 'top' : 'bottom';

      // Horizontal positioning to keep tooltip on screen
      let horizontal: 'left' | 'center' | 'right' = 'center';
      if (spaceLeft < 150) {
        horizontal = 'left';
      } else if (spaceRight < 150) {
        horizontal = 'right';
      }

      setPosition({ vertical, horizontal });
    }
  }, [isVisible]);

  const horizontalClasses = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0',
  };

  const arrowHorizontalClasses = {
    left: 'left-3',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-3',
  };

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
      )}

      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700
            rounded-lg shadow-lg w-72 whitespace-normal
            ${position.vertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            ${horizontalClasses[position.horizontal]}
          `}
        >
          {content}
          <div
            className={`
              absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45
              ${position.vertical === 'top' ? 'bottom-[-4px]' : 'top-[-4px]'}
              ${arrowHorizontalClasses[position.horizontal]}
            `}
          />
        </div>
      )}
    </span>
  );
}
