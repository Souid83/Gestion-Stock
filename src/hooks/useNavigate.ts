/**
 * useNavigate Hook
 * Navigation util pour l'app qui n'utilise pas react-router pour les sous-pages.
 * Fournit une API simple pour ouvrir les écrans internes via App.setCurrentPage exposé en window.
 */
export function useNavigate() {
  const navigateToProduct = (pageId: string) => {
    try {
      // 1) Utiliser l'API exposée par App si disponible
      const setter = (window as any).__setCurrentPage as ((p: string) => void) | undefined;
      if (typeof setter === 'function') {
        setter(pageId);
      } else {
        // 2) Fallback: mettre ?page=pageId dans l'URL (App le lira)
        const u = new URL(window.location.href);
        u.searchParams.set('page', pageId);
        window.history.pushState({}, '', `${u.pathname}${u.search}${u.hash}`);
      }
      // 3) Notifier éventuellement les listeners
      try {
        window.dispatchEvent(new CustomEvent('nav:page-changed', { detail: { page: pageId } }));
      } catch {}
    } catch (e) {
      console.warn('[useNavigate] navigateToProduct failed:', e);
    }
  };

  return { navigateToProduct };
}

export default useNavigate;
