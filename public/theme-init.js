(() => {
  const accents = ['graphite', 'moss', 'plum', 'clay', 'slate'];
  const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  let preference = 'system';
  let accent = 'graphite';
  let customAccent = '#666b70';
  let useCustomAccent = false;

  try {
    for (const key of ['drawn-by-sound.settings.v1', 'vibratoflow.settings.v3', 'vibratoflow.settings.v2']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored = JSON.parse(raw);
      if (stored && ['system', 'light', 'dark'].includes(stored.appearance)) {
        preference = stored.appearance;
      }
      if (stored && accents.includes(stored.interfaceAccent)) accent = stored.interfaceAccent;
      if (stored && isHex(stored.customInterfaceAccent)) customAccent = stored.customInterfaceAccent;
      useCustomAccent = stored?.useCustomInterfaceAccent === true;
      break;
    }
  } catch {
    preference = 'system';
  }

  const resolved =
    preference === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.accent = useCustomAccent ? 'custom' : accent;
  document.documentElement.style.setProperty('--accent-custom', customAccent);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = resolved === 'dark' ? '#1b1d1f' : '#dfe1df';
})();
