import { useEffect, useRef } from 'react';

/**
 * Calls `fn` immediately on mount, then repeats every `interval` ms.
 * Stops when the component unmounts or when `enabled` is false.
 *
 * @param {Function} fn        - async-safe callback; a new ref is captured each render
 * @param {number}   interval  - polling cadence in ms (default 10 000)
 * @param {boolean}  enabled   - set false to suspend polling (default true)
 */
export default function usePolling(fn, interval = 10000, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    fnRef.current();
    const id = setInterval(() => fnRef.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}
