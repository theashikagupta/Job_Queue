export const LOGO_LIGHT_SRC = '/assets/logo-lm.png';
export const LOGO_DARK_SRC = '/assets/logo-dm.png';

export function getLogoSrc(isDarkMode) {
  return isDarkMode ? LOGO_DARK_SRC : LOGO_LIGHT_SRC;
}
