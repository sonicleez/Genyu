
import { useEffect } from 'react';

interface Hotkey {
  keys: string;
  callback: (event: KeyboardEvent) => void;
}

export const useHotkeys = (hotkeys: Hotkey[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      hotkeys.forEach(({ keys, callback }) => {
        const keyList = keys.toLowerCase().split('+').map(k => k.trim());
        const ctrl = keyList.includes('ctrl');
        const shift = keyList.includes('shift');
        const alt = keyList.includes('alt');
        const key = keyList.find(k => !['ctrl', 'shift', 'alt'].includes(k));

        if (
          event.key.toLowerCase() === key &&
          event.ctrlKey === ctrl &&
          event.shiftKey === shift &&
          event.altKey === alt
        ) {
          event.preventDefault();
          callback(event);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeys]);
};
   