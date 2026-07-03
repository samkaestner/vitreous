import { useEffect, useRef } from 'react';

/**
 * Focus trap hook for accessibility.
 * When the element referenced by the returned ref is opened,
 * it traps focus inside it until the user closes it or presses Escape.
 *
 * Usage:
 *   const ref = useFocusTrap();
 *   return <div ref={ref}>...</div>;
 */
export function useFocusTrap() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => !el.hasAttribute('data-focus-trap-skip'));

      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // When container mounts, move initial focus to first focusable element
    const focusFirstFocusable = () => {
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => !el.hasAttribute('data-focus-trap-skip'));
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    };

    // Focus first element when container becomes available
    if (container) {
      // Use requestAnimationFrame to ensure DOM is settled
      requestAnimationFrame(focusFirstFocusable);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Run once; containerRef is stable

  return containerRef;
}