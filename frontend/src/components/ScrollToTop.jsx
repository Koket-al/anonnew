import { useLayoutEffect, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop ensures that whenever a user navigates to another page/view,
 * they immediately see the top of the view rather than the footer or middle part.
 * It also handles smooth scroll to top when clicking a link pointing to the current page.
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  // Set browser history scroll restoration to manual so the browser doesn't
  // override SPA scroll resets or retain previous scroll depths during navigation.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // When clicking on a link targeting the current page (which wouldn't trigger a route change),
  // scroll smoothly to the top so the user is brought back to the upper part of the view.
  useEffect(() => {
    function handleSamePageLinkClick(e) {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (anchor.origin && anchor.origin !== window.location.origin) return;
      if (anchor.hash) return;

      if (anchor.pathname === window.location.pathname) {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    }

    window.addEventListener('click', handleSamePageLinkClick);
    return () => window.removeEventListener('click', handleSamePageLinkClick);
  }, []);

  // Reset scroll immediately when navigating to another page/route
  useLayoutEffect(() => {
    if (hash) {
      try {
        const id = hash.replace('#', '');
        const target = document.getElementById(id) || document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      } catch {
        // Fallback to top if hash is not a valid selector
      }
    }

    // Scroll viewport to top immediately
    window.scrollTo(0, 0);

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // Backup tick after paint in case async child components or layouts shift
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });

    return () => cancelAnimationFrame(rafId);
  }, [pathname, search, hash]);

  return null;
}
