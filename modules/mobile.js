import { G } from './state.js';
import { fmtDateISO } from './helpers.js';

export const isMobileGC = () => window.matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)').matches;

export function installMobileStyles() {
  if (document.getElementById('gcMobileStyles')) return;
  const link = document.createElement('link');
  link.id = 'gcMobileStyles';
  link.rel = 'stylesheet';
  link.href = '/modules/mobile.css?v=20261024-iphone';
  document.head.append(link);
}

// Ask the embedded clinical editor before destroying its DOM.
export function canLeaveClinicalPanel() {
  const frame = document.getElementById('gcFeedPanelIframe');
  if (!frame) return true;
  try {
    if (frame.contentWindow.__gc_canLeaveConsultation?.() === false) return false;
    return frame.contentWindow.__gc_canLeaveCare?.() !== false;
  } catch { return false; }
}

export function wireMobileNavigation() {
  const more = document.getElementById('gcMobileMore');
  const trigger = document.getElementById('gcMobileMoreButton');
  trigger?.addEventListener('click', () => {
    more.showModal();
    trigger.setAttribute('aria-expanded', 'true');
  });
  more?.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
  more?.querySelector('[data-close-more]')?.addEventListener('click', () => more.close());
  document.querySelector('[data-mobile-today]')?.addEventListener('click', async () => {
    if (!canLeaveClinicalPanel()) return;
    G.selectedDayISO = fmtDateISO(new Date());
    G.agendaView = 'day';
    G.currentView = G.role === 'administrativo' ? 'gestaoagenda' : 'agenda';
    await window.__gc_renderCurrentView?.();
  });
}
