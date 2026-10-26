export const SITE_URL = 'https://sahityarachana.org';
export const SITE_HOST = 'sahityarachana.org';

export const COLORS = {
  background: '#FFFFFF',
  splash: '#FDF1E8',
  primary: '#FF9800',
  accent: '#2196F3',
  text: '#2B2B2B',
  muted: '#7A7A7A',
};

// Give up on a page that has not finished loading after this long.
export const LOAD_TIMEOUT_MS = 30000;
// Minimum time the animated splash stays up so it never just flashes.
export const MIN_SPLASH_MS = 2600;

// Parts of the website hidden inside the app. Add your own selectors if the footer
// uses an unusual class or id, e.g. '.my-custom-footer'.
export const HIDDEN_SELECTORS = [
  'footer',
  '[role="contentinfo"]',
  '#footer',
  '.footer',
  '.site-footer',
  '.main-footer',
  '#colophon',
];
