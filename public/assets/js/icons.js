/* Inline SVG icons (stroke = currentColor). Keep the set small and consistent.
   A default 1em box keeps inline icons text-sized; CSS rules (e.g. .state__icon svg)
   still override this where a larger icon is wanted. */
const S = (p) => `<svg class="ic" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;vertical-align:-0.15em">${p}</svg>`;

export const icons = {
  calendar: S('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/>'),
  sparkles: S('<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>'),
  chevronRight: S('<path d="M9 6l6 6-6 6"/>'),
  chevronLeft: S('<path d="M15 6l-6 6 6 6"/>'),
  chevronDown: S('<path d="M6 9l6 6 6-6"/>'),
  search: S('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  copy: S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  check: S('<path d="M20 6L9 17l-5-5"/>'),
  info: S('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  warn: S('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  alert: S('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  bulb: S('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.2 1 2.5h6c0-1.3.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>'),
  hook: S('<path d="M12 3v10a4 4 0 1 1-4-4"/><circle cx="12" cy="3" r="0.5"/>'),
  send: S('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
  message: S('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  layers: S('<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>'),
  tag: S('<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  megaphone: S('<path d="M3 11v2a1 1 0 0 0 1 1h2l8 5V5L6 10H4a1 1 0 0 0-1 1zM17 8a4 4 0 0 1 0 8"/>'),
  compass: S('<circle cx="12" cy="12" r="10"/><path d="m16 8-6 2-2 6 6-2 2-6z"/>'),
  refresh: S('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>'),
  inbox: S('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>'),
  list: S('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  shield: S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
};
