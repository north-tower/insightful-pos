import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DEMO_BRANDING } from '@/lib/demoMode';

const DEFAULT_TITLE = 'Insightful POS - Point of Sale System';

/** Sets document title and favicon when demo user is active. */
export function DemoBrandingEffect() {
  const { isDemo } = useAuth();

  useEffect(() => {
    if (!isDemo) return;

    const prevTitle = document.title;
    document.title = `${DEMO_BRANDING.name} — Demo`;

    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    const createdLink = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const prevHref = link.href;
    link.type = 'image/jpeg';
    link.href = DEMO_BRANDING.logoUrl;

    return () => {
      document.title = prevTitle;
      if (createdLink && link?.parentNode) {
        link.parentNode.removeChild(link);
      } else if (link) {
        link.href = prevHref;
      }
    };
  }, [isDemo]);

  return null;
}

export { DEFAULT_TITLE };
