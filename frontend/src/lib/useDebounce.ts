import { useEffect, useState } from 'react';

/** Returns `value` after it has stopped changing for `delay` ms, so typing does not fire a request per keystroke. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
