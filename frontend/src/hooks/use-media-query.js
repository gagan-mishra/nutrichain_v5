import { useMemo, useSyncExternalStore } from "react";

export function useMediaQuery(query) {
  const store = useMemo(() => {
    const media = window.matchMedia(query);
    return {
      read: () => media.matches,
      subscribe(listener) {
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
      },
    };
  }, [query]);
  return useSyncExternalStore(store.subscribe, store.read);
}
