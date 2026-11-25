/* Cocobit — interacciones del sitio (sin dependencias) */

/* ---------- Tema claro / oscuro (2 estados: sistema u opuesto) ---------- */
const meta = document.querySelector('meta[name="color-scheme"]');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const KEY = 'color-scheme';

function readStored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function applyScheme(value) {
  meta.content = value ?? 'light dark';
}
function renderedScheme() {
  const v = meta.content;
  if (v === 'light' || v === 'dark') return v;
  return systemDark.matches ? 'dark' : 'light';
}
document.querySelectorAll('.theme-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = renderedScheme() === 'dark' ? 'light' : 'dark';
    const system = systemDark.matches ? 'dark' : 'light';
    try {
      if (target === system) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, target);
    } catch { /* sin almacenamiento: se aplica igual */ }
    applyScheme(target === system ? null : target);
  });
});
addEventListener('storage', (e) => { if (e.key === KEY) applyScheme(e.newValue); });

/* ---------- Navegación: barra en PC si cabe, panel a pantalla completa si no ---------- */
const header = document.querySelector('.site-header');
const inner = header?.querySelector('.header-inner');
const menu = header?.querySelector('#site-menu');
const trigger = header?.querySelector('.dropdown-trigger');
const panel = header?.querySelector('#guides-menu');
const dropdownItem = trigger?.closest('.nav-dropdown');

if (header && inner && menu) {
  let lastWidth = 0;
  let wide = false;

  const setWide = (value) => {
    wide = value;
    header.classList.toggle('is-wide', value);
    if (value) {
      menu.removeAttribute('popover');
      panel?.setAttribute('popover', 'auto');
    } else {
      if (panel?.matches?.(':popover-open')) panel.hidePopover();
      panel?.removeAttribute('popover');
      menu.setAttribute('popover', 'auto');
    }
    trigger?.setAttribute('aria-expanded', 'false');
  };

  const layout = () => {
    const width = inner.clientWidth;
    // En modo colapsado solo se vuelve a medir si el ancho creció (evita parpadeos)
    if (!wide && width <= lastWidth && lastWidth !== 0) { lastWidth = width; return; }
    lastWidth = width;
    const menuWasOpen = !!menu.matches?.(':popover-open');
    header.classList.add('is-measuring');
    if (menuWasOpen) menu.hidePopover();
    setWide(true);
    const fits = inner.scrollWidth <= inner.clientWidth;
    if (!fits) {
      setWide(false);
      if (menuWasOpen) menu.showPopover?.();
    }
    requestAnimationFrame(() => header.classList.remove('is-measuring'));
  };

  const ro = new ResizeObserver(layout);
  ro.observe(header);
  ro.observe(menu);

  // Cerrar el panel móvil al elegir un enlace
  menu.addEventListener('click', (e) => {
    if (!wide && e.target.closest('a') && menu.matches?.(':popover-open')) menu.hidePopover();
  });

  if (trigger && panel && dropdownItem) {
    // aria-expanded sigue al estado real del popover
    panel.addEventListener('toggle', (e) => {
      trigger.setAttribute('aria-expanded', String(e.newState === 'open'));
      if (e.newState === 'open' && !CSS.supports('position-area', 'block-end')) {
        const t = trigger.getBoundingClientRect();
        const s = panel.getBoundingClientRect();
        panel.style.top = `${t.bottom + 12}px`;
        panel.style.left = `${Math.max(8, Math.min(t.left, innerWidth - s.width - 8))}px`;
      }
    });

    // Vista previa al pasar el ratón (solo con puntero fino y en modo PC)
    let preview = false;
    const canHover = matchMedia('(hover: hover)');
    dropdownItem.addEventListener('pointerenter', (e) => {
      if (!wide || !canHover.matches || e.pointerType === 'touch') return;
      if (!panel.matches(':popover-open')) {
        panel.showPopover({ source: trigger });
        preview = true;
      }
    });
    dropdownItem.addEventListener('pointerleave', () => {
      if (preview && panel.matches(':popover-open')) panel.hidePopover();
      preview = false;
    });
    trigger.addEventListener('click', (e) => {
      if (preview) { e.preventDefault(); preview = false; } // un clic durante la vista previa la fija
    });
    // Cerrar al salir con Tab del grupo
    dropdownItem.addEventListener('focusout', (e) => {
      if (e.relatedTarget && !dropdownItem.contains(e.relatedTarget) && panel.matches?.(':popover-open')) panel.hidePopover();
    });
  }
}

/* ---------- Botones de copiar ---------- */
const timers = new WeakMap();
let lastMessage = '';
function report(button, ok) {
  const tip = button.nextElementSibling;
  clearTimeout(timers.get(button));
  button.removeAttribute('data-copied');
  button.removeAttribute('data-failed');
  let message = ok ? 'Copiado' : 'No se pudo copiar';
  if (message === lastMessage) message += ' ';
  lastMessage = message;
  tip.textContent = '';
  button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
  requestAnimationFrame(() => (tip.textContent = message));
  timers.set(button, setTimeout(() => {
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');
    tip.textContent = '';
  }, 2000));
}
async function copy(button, target) {
  const text = target.innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    report(button, true);
  } catch {
    report(button, false);
  }
}
if ('CommandEvent' in window) {
  document.addEventListener('command', (e) => {
    if (e.command === '--copy') copy(e.source, e.target);
  }, true);
} else {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const button = e.target.closest('button[command="--copy"]');
    if (!button) return;
    const target = document.getElementById(button.getAttribute('commandfor'));
    if (target) copy(button, target);
  });
}

/* ---------- Pestañas (selección sigue al foco) ---------- */
const nativeFocusgroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup');
document.querySelectorAll('.tabs').forEach((tabsEl) => {
  const list = tabsEl.querySelector('.tablist');
  const tabs = [...list.querySelectorAll('button')];
  const panels = tabs.map((t) => document.querySelector(`[aria-labelledby="${t.id}"]`));
  if (!nativeFocusgroup) {
    list.setAttribute('role', 'tablist');
    tabs.forEach((t) => t.setAttribute('role', 'tab'));
  }
  function select(tab, focus = false) {
    tabs.forEach((t, i) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.toggleAttribute('focusgroupstart', on);
      if (!nativeFocusgroup) t.tabIndex = on ? 0 : -1;
      if (on) { panels[i].removeAttribute('hidden'); panels[i].tabIndex = 0; }
      else { panels[i].hidden = 'until-found'; panels[i].removeAttribute('tabindex'); }
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
  }
  tabs.forEach((t) => {
    t.addEventListener('click', () => select(t));
    if (nativeFocusgroup) t.addEventListener('focus', () => select(t));
  });
  if (!nativeFocusgroup) {
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  }
  panels.forEach((p, i) => p?.addEventListener('beforematch', () => select(tabs[i])));
  // Preselecciona el sistema operativo del visitante
  const ua = navigator.userAgentData?.platform ?? navigator.platform ?? '';
  const guess = /win/i.test(ua) ? 'windows' : /mac/i.test(ua) ? 'macos' : /linux/i.test(ua) ? 'linux' : null;
  const preferred = guess && tabs.find((t) => t.dataset.os === guess);
  select(preferred || tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]);
});

/* ---------- Índice: resalta la sección visible ---------- */
const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
if (tocLinks.length) {
  const map = new Map(tocLinks.map((a) => [document.querySelector(a.getAttribute('href')), a]));
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      tocLinks.forEach((a) => a.removeAttribute('aria-current'));
      map.get(entry.target)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  map.forEach((_, section) => section && io.observe(section));
  // En pantallas grandes el índice va siempre abierto
  const details = document.querySelector('.toc details');
  const wide = matchMedia('(min-width: 960px)');
  const sync = () => { if (details && wide.matches) details.open = true; };
  sync();
  wide.addEventListener('change', sync);
}

/* ---------- Año del pie ---------- */
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
