import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ContentKind, ViewName } from '../models/Content';
import { parsePath, viewToPath, storeKind, Route } from '../utils/paths';

// Owns URL-driven navigation for the whole app (D-6). Kind is global (D-7):
// switching kind preserves the current view. Provider nests inside AuthProvider
// in src/index.tsx. Extends the spec's { kind, setKind } with the view/navigate
// bits so a single context owns all routing (the app has no router).
interface KindContextValue {
  kind: ContentKind;
  view: ViewName;
  /** Switch content kind, staying on the current view (D-7). */
  setKind: (kind: ContentKind) => void;
  /** Navigate to a view, staying in the current kind unless one is given. */
  navigate: (view: ViewName, kind?: ContentKind) => void;
}

const KindContext = createContext<KindContextValue | undefined>(undefined);

export const KindProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname));

  // Make the URL honest on first load: `/` and unknown paths parse to a
  // canonical (kind, view), so rewrite the address bar to match.
  useEffect(() => {
    const canonical = viewToPath(route.kind, route.view);
    if (window.location.pathname !== canonical) {
      window.history.replaceState({}, '', canonical);
    }
    // Run once on mount; route is seeded from the initial pathname.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep state in sync with Back/Forward.
  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((view: ViewName, kind?: ContentKind) => {
    setRoute((prev) => {
      const nextKind = kind ?? prev.kind;
      window.history.pushState({}, '', viewToPath(nextKind, view));
      storeKind(nextKind);
      return { kind: nextKind, view };
    });
  }, []);

  const setKind = useCallback(
    (kind: ContentKind) => {
      // Preserve the current view; cascade the kind to it (D-7).
      navigate(route.view, kind);
    },
    [navigate, route.view],
  );

  return (
    <KindContext.Provider value={{ kind: route.kind, view: route.view, setKind, navigate }}>
      {children}
    </KindContext.Provider>
  );
};

export function useKind(): KindContextValue {
  const ctx = useContext(KindContext);
  if (!ctx) throw new Error('useKind must be used within a KindProvider');
  return ctx;
}
