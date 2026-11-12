const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const app = $('#app');
const rail = $('#rail');
const scrim = $('#scrim');
const wrap = $('#wrap');
const log = $('#log');
const q = $('#q');
const send = $('#send');
const entries = $('#entries');
const search = $('#search');
const chatTitle = $('#chatTitle');
const chatTitleInput = $('#chatTitleInput');
const chatSub = $('#chatSub');
const offlineBanner = $('#offlineBanner');
const jump = $('#jump');
const jumpCount = $('#jumpCount');
const toasts = $('#toasts');
const live = $('#live');
const settingsDialog = $('#settingsDialog');
const shortcutsDialog = $('#shortcutsDialog');
const confirmDialog = $('#confirmDialog');
const confirmTitle = $('#confirmTitle');
const confirmBody = $('#confirmBody');
const confirmOk = $('#confirmOk');

const browserTzRaw = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const browserTz = browserTzRaw === 'Asia/Calcutta' ? 'Asia/Kolkata' : browserTzRaw;
let tz = browserTz;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${WD[d.getDay()]} ${pad(d.getDate())} ${MO[d.getMonth()]} ${d.getFullYear()}`;
const dateShort = (d) => `${pad(d.getDate())} ${MO[d.getMonth()]}`;
const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseTs = (ts) => (ts ? new Date(ts) : new Date());
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); } };
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const icon = (d, size = 14) => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.5');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
};
const ARROW = 'M3 8h9M8.5 4.5 12 8l-3.5 3.5';
const EXT = 'M6 3h7v7M13 3 7 9M12 9.5V13H3V4h3.5';
const getStore = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const setStore = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const removeStore = (k) => { try { localStorage.removeItem(k); } catch {} };

const DEFAULT_SETTINGS = {
  theme: 'system',
  accent: 'ox',
  size: 'md',
  density: 'comfortable',
  width: 760,
  motion: 'full',
  enterSend: true,
  timestamps: true,
  railHidden: false,
  tz: '',
};
const ACCENTS = {
  ox: { light: '#8a3030', dark: '#d58d80', softLight: '#f0ded6', softDark: '#33211f' },
  blue: { light: '#2e4f78', dark: '#94b4da', softLight: '#dce6f1', softDark: '#1c2a38' },
  green: { light: '#3f6b4f', dark: '#93c5a6', softLight: '#dfe9df', softDark: '#1d2b22' },
  violet: { light: '#6b4a7a', dark: '#c4a0d4', softLight: '#eadff0', softDark: '#2a1f30' },
  amber: { light: '#8a5a1f', dark: '#e0b57e', softLight: '#f2e6cd', softDark: '#332613' },
};
let settings = { ...DEFAULT_SETTINGS };
try { settings = { ...settings, ...(JSON.parse(getStore('minimi-settings') || '{}') || {}) }; } catch {}
const saveSettings = () => setStore('minimi-settings', JSON.stringify(settings));

const hexRgba = (hex, a) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(138,48,48,${a})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const mobileMQ = matchMedia('(max-width: 1023px)');
const narrowMQ = matchMedia('(max-width: 767px)');
const isMobile = () => mobileMQ.matches;
const isNarrow = () => narrowMQ.matches;
const isDark = () => settings.theme === 'dark' || (settings.theme === 'system' && darkMQ.matches);

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? 'dark' : 'light';
  root.style.colorScheme = isDark() ? 'dark' : 'light';
  root.dataset.size = settings.size || 'md';
  root.dataset.density = settings.density || 'comfortable';
  if (settings.motion === 'reduce') root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
  root.style.setProperty('--col', `${Number(settings.width) || 760}px`);
  const themeMeta = $('#themeColor');
  if (themeMeta) themeMeta.content = isDark() ? '#14120f' : '#ece3cf';

  const accent = ACCENTS[settings.accent] || ACCENTS.ox;
  const color = isDark() ? accent.dark : accent.light;
  const soft = isDark() ? accent.softDark : accent.softLight;
  root.style.setProperty('--ox', color);
  root.style.setProperty('--ox-soft', soft);
  root.style.setProperty('--ox-line', hexRgba(color, isDark() ? 0.34 : 0.32));
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-soft', soft);
  root.style.setProperty('--accent-line', hexRgba(color, isDark() ? 0.34 : 0.32));

  const labels = { system: 'Auto', light: 'Light', dark: 'Dark' };
  const themeLabel = $('#themeLabel');
  if (themeLabel) themeLabel.textContent = labels[settings.theme] || 'Auto';
  $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === settings.theme)));
  $$('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === settings.accent)));
  $$('[data-size-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sizeChoice === settings.size)));
  $$('[data-density-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.densityChoice === settings.density)));
  const widthRange = $('#widthRange');
  if (widthRange) widthRange.value = String(settings.width || 760);
  const widthValue = $('#widthValue');
  if (widthValue) widthValue.textContent = `${settings.width || 760}px`;
  const reduceMotion = $('#reduceMotion');
  if (reduceMotion) reduceMotion.checked = settings.motion === 'reduce';
  const enterToSend = $('#enterToSend');
  if (enterToSend) enterToSend.checked = settings.enterSend !== false;
  const showTimestamps = $('#showTimestamps');
  if (showTimestamps) showTimestamps.checked = settings.timestamps !== false;
  tz = settings.tz || browserTz;
  const tzSelect = $('#tzSelect');
  if (tzSelect && tzSelect.value !== (settings.tz || '')) tzSelect.value = settings.tz || '';
  applyRail();
}

function tzOffsetLabel(zone = tz) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return (part?.value || 'GMT').replace('GMT', 'UTC').replace('UTC', 'UTC ');
  } catch {
    return 'UTC';
  }
}

function fillTimezones() {
  const select = $('#tzSelect');
  if (!select) return;
  const auto = el('option', '', `Auto - ${browserTz} (${tzOffsetLabel(browserTz).trim()})`);
  auto.value = '';
  select.append(auto);
  const zones = new Set([browserTz, tz, 'UTC']);
  try {
    for (const zone of Intl.supportedValuesOf('timeZone')) zones.add(zone);
  } catch {
    for (const zone of ['Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney']) zones.add(zone);
  }
  for (const zone of [...zones].sort()) {
    const option = el('option', '', zone);
    option.value = zone;
    select.append(option);
  }
  select.value = settings.tz || '';
  select.addEventListener('change', () => {
    settings.tz = select.value;
    saveSettings();
    applySettings();
    tick();
    toast(settings.tz ? `Timezone set to ${settings.tz}.` : 'Timezone follows this browser.');
  });
}

function setTheme(mode) {
  settings.theme = mode;
  saveSettings();
  applySettings();
}

darkMQ.addEventListener('change', () => { if (settings.theme === 'system') applySettings(); });

function toggleTheme() {
  const order = ['system', 'light', 'dark'];
  setTheme(order[(order.indexOf(settings.theme) + 1) % order.length]);
}

$$('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeChoice)));
$$('[data-accent]').forEach((b) => b.addEventListener('click', () => {
  settings.accent = b.dataset.accent;
  saveSettings();
  applySettings();
}));
$$('[data-size-choice]').forEach((b) => b.addEventListener('click', () => {
  settings.size = b.dataset.sizeChoice;
  saveSettings();
  applySettings();
}));
$$('[data-density-choice]').forEach((b) => b.addEventListener('click', () => {
  settings.density = b.dataset.densityChoice;
  saveSettings();
  applySettings();
}));
$('#widthRange')?.addEventListener('input', (e) => {
  settings.width = Number(e.target.value);
  saveSettings();
  applySettings();
});
$('#reduceMotion')?.addEventListener('change', (e) => {
  settings.motion = e.target.checked ? 'reduce' : 'full';
  saveSettings();
  applySettings();
});
$('#enterToSend')?.addEventListener('change', (e) => {
  settings.enterSend = e.target.checked;
  saveSettings();
});
$('#showTimestamps')?.addEventListener('change', (e) => {
  settings.timestamps = e.target.checked;
  saveSettings();
  if (!busy) loadHistory();
});
$('#themeToggle')?.addEventListener('click', toggleTheme);
$('#settingsBtn')?.addEventListener('click', () => openSettings());

function applyRail() {
  if (!app) return;
  const hidden = !isMobile() && settings.railHidden;
  app.classList.toggle('rail-hidden', hidden);
  const railToggle = $('#railToggle');
  if (railToggle) railToggle.setAttribute('aria-expanded', String(!hidden));
}

function setRailHidden(hidden) {
  settings.railHidden = hidden;
  saveSettings();
  applyRail();
}

function openNav() {
  document.body.classList.add('nav-open');
  const menu = $('#menu');
  if (menu) menu.setAttribute('aria-expanded', 'true');
  q.blur();
  syncRail();
  if (isMobile()) requestAnimationFrame(() => $('#railClose')?.focus());
}

function closeNav() {
  const wasOpen = document.body.classList.contains('nav-open');
  document.body.classList.remove('nav-open');
  const menu = $('#menu');
  if (menu) menu.setAttribute('aria-expanded', 'false');
  syncRail();
  if (wasOpen && isMobile()) menu?.focus();
}

function syncRail() {
  if (!rail) return;
  const main = $('.main');
  const open = document.body.classList.contains('nav-open');
  if (!isMobile()) {
    rail.removeAttribute('inert');
    rail.removeAttribute('role');
    rail.removeAttribute('aria-modal');
    main?.removeAttribute('inert');
    document.body.classList.remove('nav-open');
    return;
  }
  rail.toggleAttribute('inert', !open);
  if (open) {
    rail.setAttribute('role', 'dialog');
    rail.setAttribute('aria-modal', 'true');
    main?.setAttribute('inert', '');
  } else {
    rail.removeAttribute('role');
    rail.removeAttribute('aria-modal');
    main?.removeAttribute('inert');
  }
}

$('#menu')?.addEventListener('click', () => (document.body.classList.contains('nav-open') ? closeNav() : openNav()));
$('#railClose')?.addEventListener('click', closeNav);
scrim?.addEventListener('click', closeNav);
$('#railToggle')?.addEventListener('click', () => {
  if (isMobile()) {
    if (document.body.classList.contains('nav-open')) closeNav();
    else openNav();
  } else {
    setRailHidden(!settings.railHidden);
  }
});
mobileMQ.addEventListener('change', () => {
  if (!isMobile()) {
    document.body.classList.remove('nav-open');
    syncRail();
  } else {
    syncRail();
  }
  applyRail();
});

function navFocusables() {
  return $$('button:not([disabled]),a[href],input,textarea,[tabindex]:not([tabindex="-1"])', rail)
    .filter((n) => n.getClientRects().length && !n.closest('[inert]'));
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !document.body.classList.contains('nav-open') || !isMobile()) return;
  const list = navFocusables();
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && (document.activeElement === first || !rail.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !rail.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
});

let conv = getStore('minimi-conv');
if (!conv) {
  conv = uuid();
  setStore('minimi-conv', conv);
}
let convs = [];
let fallbackTitle = '';
let searchTerm = '';
let showArchived = false;
let busy = false;
let historySeq = 0;
let historyPromise = null;
let recall = [];
let recallIdx = 0;
let recallDraft = '';
let ac = null;
let stick = true;
let unread = 0;
let sourceSeen = new Set();
let pendingEdit = null;
const deletingIds = new Set();
let drafts = {};
try { drafts = JSON.parse(getStore('minimi-drafts') || '{}') || {}; } catch {}
const persistDrafts = () => setStore('minimi-drafts', JSON.stringify(drafts));

function saveDraft() {
  if (!conv || !q) return;
  const value = q.value;
  if (value.trim()) drafts[conv] = value;
  else delete drafts[conv];
  persistDrafts();
}

function loadDraft() {
  if (!q) return;
  q.value = drafts[conv] || '';
  sizeQ();
  syncSend();
}

function relativeGroup(iso) {
  const d = parseTs(iso);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

function findConv(id) {
  return convs.find((c) => c.id === id);
}

function refreshHeader() {
  const meta = findConv(conv);
  const title = meta?.title || fallbackTitle || 'New chat';
  chatTitle.textContent = title;
  chatTitle.title = 'Rename chat';
  const bits = [];
  if (meta?.pinned) bits.push('Pinned');
  if (meta?.archived) bits.push('Archived');
  if (meta?.count) bits.push(`${meta.count} turn${meta.count === 1 ? '' : 's'}`);
  if (meta?.updatedAt) bits.push(relativeGroup(meta.updatedAt));
  chatSub.textContent = bits.length ? bits.join(' · ') : 'Time-aware · local';
}

function renderRailSkeleton() {
  entries.innerHTML = '';
  const box = el('div', 'rail-skeleton');
  for (let i = 0; i < 6; i++) box.append(el('div', 'skel-row'));
  entries.append(box);
}

function renderRail() {
  entries.innerHTML = '';
  const term = searchTerm.trim().toLowerCase();
  let list = convs.filter((c) => (showArchived ? c.archived : !c.archived));
  if (term) {
    list = list.filter((c) => `${c.title || ''} ${c.snippet || ''}`.toLowerCase().includes(term));
  }
  if (!list.length) {
    const text = term
      ? `No matches for “${searchTerm.trim()}”.`
      : showArchived
        ? 'No archived chats.'
        : 'No entries yet. Your dates will collect here.';
    const box = el('div', 'rail-empty', text);
    if (!term && !showArchived) {
      const demo = el('button', 'button rail-demo', 'Load demo history');
      demo.type = 'button';
      demo.addEventListener('click', () => loadDemoHistory(demo));
      box.append(demo);
    }
    entries.append(box);
    return;
  }

  if (showArchived) {
    entries.append(el('div', 'group-label', 'Archived'));
    list.forEach((item) => entries.append(entryNode(item, true)));
    return;
  }

  const pinned = list.filter((c) => c.pinned);
  const rest = list.filter((c) => !c.pinned);
  if (pinned.length) {
    entries.append(el('div', 'group-label', 'Pinned'));
    pinned.forEach((item) => entries.append(entryNode(item, false)));
  }
  let group = '';
  for (const item of rest) {
    const g = relativeGroup(item.updatedAt);
    if (g !== group) {
      group = g;
      entries.append(el('div', 'group-label', g));
    }
    entries.append(entryNode(item, false));
  }
}

function entryNode(item, archivedView) {
  const row = el('div', 'entry');
  row.dataset.id = item.id;
  row.setAttribute('aria-current', String(item.id === conv));
  const main = el('button', 'entry-main');
  main.type = 'button';
  main.title = `${item.title || 'Untitled entry'}${item.count ? ` · ${item.count} turn${item.count === 1 ? '' : 's'}` : ''}`;
  const title = el('span', 'entry-title');
  if (item.pinned && !archivedView) title.append(el('span', 'pin-dot'));
  title.append(document.createTextNode(item.title || 'Untitled entry'));
  main.append(title, el('span', 'entry-date', item.updatedAt ? dateShort(parseTs(item.updatedAt)) : ''));
  const more = el('button', 'entry-menu');
  more.type = 'button';
  more.setAttribute('aria-label', `Actions for ${item.title || 'Untitled entry'}`);
  more.setAttribute('aria-haspopup', 'menu');
  more.append(icon('M8 3.2h.01M8 8h.01M8 12.8h.01'));
  more.querySelector('svg')?.setAttribute('stroke-width', '2.6');
  main.addEventListener('click', () => switchTo(item.id));
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    openEntryMenu(more, item);
  });
  row.append(main, more);
  return row;
}

function setActive() {
  $$('.entry', entries).forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === conv)));
}

function renderRailSafe() {
  renderRail();
  setActive();
}

async function loadConversations(silent = false) {
  if (!silent) renderRailSkeleton();
  try {
    const r = await fetch('/api/conversations', { cache: 'no-store' });
    if (!r.ok) throw new Error(`Conversations unavailable (${r.status})`);
    const list = await r.json();
    convs = (Array.isArray(list) ? list : []).filter((c) => !deletingIds.has(c.id));
    renderRailSafe();
    refreshHeader();
  } catch {
    if (silent) return;
    entries.innerHTML = '';
    entries.append(el('div', 'rail-empty', 'Could not load entries. They will refresh after the next answer.'));
  }
}

async function loadDemoHistory(button) {
  const label = 'Load demo history';
  if (button) { button.disabled = true; button.textContent = 'Loading…'; }
  try {
    const r = await fetch('/api/demo/seed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tz }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    await loadConversations(true);
    toast(data.added ? `Loaded ${data.added} demo turns.` : 'Demo history is already loaded.');
  } catch (e) {
    toast(`Could not load demo history: ${e.message}`, { type: 'error' });
  } finally {
    if (button) { button.disabled = false; button.textContent = label; }
  }
}

function openEntryMenu(anchor, item) {
  const items = [
    { label: 'Rename', onSelect: () => startEntryRename(item.id, anchor.closest('.entry')) },
    { label: item.pinned ? 'Unpin' : 'Pin', onSelect: () => patchConv(item.id, { pinned: !item.pinned }) },
    {
      label: item.archived ? 'Unarchive' : 'Archive',
      onSelect: () => patchConv(item.id, { archived: !item.archived }),
    },
    { sep: true },
    { label: 'Delete', danger: true, onSelect: () => deleteConversation(item.id) },
  ];
  openMenu(anchor, items);
}

function startEntryRename(id, row) {
  const item = findConv(id);
  if (!row || !item) return;
  const title = row.querySelector('.entry-title');
  if (!title || row.querySelector('.rename-input')) return;
  const input = el('input', 'rename-input');
  input.type = 'text';
  input.maxLength = 120;
  input.value = item.title || '';
  input.setAttribute('aria-label', 'Chat title');
  title.replaceWith(input);
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (save && value && value !== item.title) patchConv(id, { title: value });
    else renderRailSafe();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  input.focus();
  input.select();
}

function startHeaderRename() {
  if (!chatTitleInput || !chatTitleInput.hidden) return;
  const meta = findConv(conv);
  chatTitle.hidden = true;
  chatTitleInput.hidden = false;
  chatTitleInput.value = meta?.title || fallbackTitle || '';
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const value = chatTitleInput.value.trim();
    chatTitleInput.hidden = true;
    chatTitle.hidden = false;
    if (save && value) {
      fallbackTitle = value;
      patchConv(conv, { title: value });
    }
    refreshHeader();
    q.focus();
  };
  chatTitleInput.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      chatTitleInput.removeEventListener('keydown', onKey);
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      chatTitleInput.removeEventListener('keydown', onKey);
      finish(false);
    }
  });
  chatTitleInput.addEventListener('blur', () => finish(true), { once: true });
  chatTitleInput.focus();
  chatTitleInput.select();
}

chatTitle?.addEventListener('click', startHeaderRename);

async function patchConv(id, patch) {
  const item = findConv(id);
  if (!item && id !== conv) return;
  const previous = item ? { ...item } : null;
  if (item) {
    Object.assign(item, patch);
    renderRailSafe();
  }
  refreshHeader();
  try {
    const r = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`Update failed (${r.status})`);
    if (patch.title && id === conv) fallbackTitle = patch.title;
    refreshHeader();
    if (item) loadConversations(true);
  } catch (e) {
    if (item && previous) {
      Object.assign(item, previous);
      renderRailSafe();
    }
    refreshHeader();
    toast(`Could not update chat: ${e.message}`, { type: 'error' });
  }
}

function newChat(focus = true) {
  saveDraft();
  if (busy) stopGeneration();
  cancelEdit(false);
  sourceSeen = new Set();
  conv = uuid();
  setStore('minimi-conv', conv);
  historySeq++;
  recall = [];
  recallIdx = 0;
  recallDraft = '';
  fallbackTitle = '';
  ac = null;
  closeNav();
  renderRailSafe();
  refreshHeader();
  loadDraft();
  emptyState();
  closeMenu();
  if (focus) q.focus();
}

$('#newChat')?.addEventListener('click', () => newChat());
$('#newChatTop')?.addEventListener('click', () => newChat());

function switchTo(id) {
  if (!id) return;
  saveDraft();
  if (busy) stopGeneration();
  cancelEdit(false);
  sourceSeen = new Set();
  conv = id;
  setStore('minimi-conv', id);
  fallbackTitle = '';
  closeNav();
  closeMenu();
  refreshHeader();
  renderRailSafe();
  loadDraft();
  loadHistory();
}

entries?.addEventListener('click', (e) => {
  const row = e.target.closest('.entry');
  if (!row || e.target.closest('.entry-menu') || e.target.closest('.rename-input')) return;
  if (row.dataset.id) switchTo(row.dataset.id);
});

entries?.addEventListener('keydown', (e) => {
  const row = e.target.closest('.entry');
  if (!row || e.target.closest('.rename-input')) return;
  const rows = $$('.entry', entries);
  const index = rows.indexOf(row);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    const next = e.key === 'Home'
      ? rows[0]
      : e.key === 'End'
        ? rows[rows.length - 1]
        : rows[(index + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
    next?.querySelector('.entry-main')?.focus();
  } else if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
    e.preventDefault();
    const item = findConv(row.dataset.id);
    if (item) openEntryMenu(row.querySelector('.entry-menu'), item);
  }
});

search?.addEventListener('input', () => {
  searchTerm = search.value;
  renderRailSafe();
});
search?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (search.value) {
      search.value = '';
      searchTerm = '';
      renderRailSafe();
    } else closeNav();
  }
});
$('#archiveToggle')?.addEventListener('click', (e) => {
  showArchived = !showArchived;
  e.currentTarget.setAttribute('aria-pressed', String(showArchived));
  e.currentTarget.title = showArchived ? 'Show active chats' : 'Show archived chats';
  renderRailSafe();
});

function formatRich(text, sources = {}) {
  const blocks = [];
  const raw = String(text ?? '');
  const withBlocks = raw.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blocks.length;
    blocks.push({ lang: String(lang || 'text').trim(), code: String(code || '').replace(/\n$/, '') });
    return `\u0000CB${i}\u0000`;
  });
  let h = esc(withBlocks);
  const inlines = [];
  h = h.replace(/`([^`\n]+)`/g, (_, code) => {
    const i = inlines.length;
    inlines.push(`<code>${code}</code>`);
    return `\u0001IC${i}\u0001`;
  });
  h = h.replace(/((?:^\|.*\|[ \t]*\n?)+)/gm, (block) => tableHtml(block));
  h = h.replace(/^#{1,4} (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  h = h.replace(/(?:^[ \t]*[-*] .+\n?)+/gm, (m) => '<ul>' + m.trim().split('\n').map((line) => `<li>${line.replace(/^[ \t]*[-*] /, '')}</li>`).join('') + '</ul>');
  h = h.replace(/(?:^[ \t]*\d+\. .+\n?)+/gm, (m) => '<ol>' + m.trim().split('\n').map((line) => `<li>${line.replace(/^[ \t]*\d+\. /, '')}</li>`).join('') + '</ol>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (m, group) => {
    const out = group.split(',').map((part) => {
      const n = part.trim();
      const s = sources[n];
      if (!s) return '';
      const title = s.title || hostOf(s.url);
      const url = safeUrl(s.url);
      return `<button type="button" class="cite" data-url="${esc(url)}" data-title="${esc(title)}" data-host="${esc(hostOf(s.url))}" data-pub="${esc(s.published || '')}" aria-label="Source ${n}: ${esc(title)}" title="${esc(title)}">${n}</button>`;
    }).filter(Boolean);
    return out.length ? out.join(' ') : m;
  });
  h = h.replace(/\u0001IC(\d+)\u0001/g, (_, i) => inlines[+i] || '');
  h = h.replace(/\u0000CB(\d+)\u0000/g, (_, i) => {
    const b = blocks[+i];
    if (!b) return '';
    return `<div class="code-block"><div class="code-head"><span class="code-lang">${esc(b.lang)}</span><button class="copy-code" type="button" data-code="${esc(b.code)}">Copy</button></div><pre><code>${esc(b.code)}</code></pre></div>`;
  });
  return h.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>').replace(/(<\/(?:ul|ol|table|pre|blockquote|div)>)<br>/g, '$1');
}

function tableHtml(block) {
  const rows = block.trim().split('\n').map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
  const body = rows.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));
  return '<table>' + body.map((row, index) => '<tr>' + row.map((cell) => `<${index ? 'td' : 'th'}>${cell}</${index ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table>';
}

function addUser(text, ts) {
  const d = parseTs(ts);
  const msg = el('article', 'msg user');
  const bubble = el('div', 'bubble');
  bubble.textContent = text;
  bubble.title = `${dateStr(d)} · ${timeStr(d)}`;
  msg.append(bubble);
  wrap.append(msg);
  return msg;
}

function setComposerHint(text) {
  const hint = $('#composerHint');
  if (!hint) return;
  hint.textContent = text || (isNarrow() ? 'Enter adds a line · send with the button' : '↑ recalls · Enter sends · Shift+Enter new line');
}

function cancelEdit(restore = true) {
  if (!pendingEdit) return;
  const previous = pendingEdit.previous || '';
  pendingEdit = null;
  if (restore) {
    q.value = previous;
    sizeQ();
    syncSend();
    if (conv && previous.trim()) {
      drafts[conv] = previous;
      persistDrafts();
    }
  }
  setComposerHint();
}

function beginEdit({ userNode, prompt, turnId, bot, previous }) {
  if (busy) return;
  if (pendingEdit) cancelEdit(true);
  pendingEdit = { userNode, prompt, turnId, bot, previous: previous || '' };
  q.value = prompt;
  sizeQ();
  syncSend();
  q.focus();
  q.setSelectionRange(q.value.length, q.value.length);
  setComposerHint('Editing turn · Enter resends · Esc cancels');
}

function attachUserActions(userNode, getPrompt, getTurnId, getBot, isLast) {
  if (!isLast) return;
  const actions = el('div', 'msg-actions');
  actions.append(actionButton('Edit', () => {
    beginEdit({
      userNode,
      prompt: getPrompt(),
      turnId: getTurnId(),
      bot: getBot(),
      previous: drafts[conv] || '',
    });
  }));
  userNode.append(actions);
}

function addBot() {
  const msg = el('article', 'msg bot');
  const avatar = el('div', 'avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const content = el('div', 'content');
  const byline = el('div', 'byline');
  const who = el('span', 'who', 'Minimi');
  const sep = el('span', 'sep', '/');
  const resolved = el('span', 'resolved');
  sep.hidden = true;
  resolved.hidden = true;
  byline.append(who, sep, resolved);
  const working = el('div', 'working');
  const typing = el('div', 'typing');
  typing.append(el('i'), el('i'), el('i'));
  const status = el('div', 'msg-meta', 'Reading…');
  working.append(typing, status);
  const body = el('div', 'body');
  const verdicts = el('section', 'verdicts');
  verdicts.hidden = true;
  const claims = el('section', 'claims');
  claims.hidden = true;
  const claimsLabel = el('div', 'sec-label', 'Claims logged');
  const claimList = el('ul', 'claim-list');
  claims.append(claimsLabel, claimList);
  const sources = el('section', 'sources');
  sources.hidden = true;
  const srcHead = el('div', 'src-head');
  const srcLabel = el('div', 'sec-label', 'Sources');
  const srcCopy = el('button', 'src-copy', 'Copy sources');
  srcCopy.type = 'button';
  srcHead.append(srcLabel, srcCopy);
  const srcList = el('ol', 'src-list');
  const srcNote = el('div', 'src-note');
  srcNote.hidden = true;
  const srcChecked = el('div', 'src-checked');
  sources.append(srcHead, srcList, srcNote, srcChecked);
  const meta = el('div', 'msg-meta');
  const trace = el('details', 'trace');
  trace.hidden = true;
  const summary = el('summary', '', 'Working notes');
  const traceBody = el('div', 'trace-body');
  trace.append(summary, traceBody);
  const actions = el('div', 'msg-actions');
  actions.hidden = true;
  content.append(byline, working, body, verdicts, claims, sources, meta, trace, actions);
  msg.append(avatar, content);
  wrap.append(msg);
  return { msg, avatar, content, byline, who, sep, resolved, working, typing, status, body, verdicts, claims, claimsLabel, claimList, sources, srcHead, srcLabel, srcCopy, srcList, srcNote, srcChecked, meta, trace, summary, traceBody, actions, rawText: '', firstText: false, userNode: null, turnId: '' };
}

function addNote(b, key, value) {
  if (!value) return;
  b.trace.hidden = false;
  const row = el('div', 'trace-row');
  row.append(el('span', 'k', key), el('span', 'v', String(value)));
  b.traceBody.append(row);
  b.summary.textContent = `Working notes · ${b.traceBody.children.length}`;
}

function setStatus(b, text) {
  if (!text) return;
  b.working.hidden = false;
  b.typing.hidden = false;
  b.status.textContent = text;
}

function setResolved(b, context) {
  if (!context) return;
  const bits = Array.isArray(context.resolved) ? context.resolved : [];
  if (bits.length) {
    b.resolved.hidden = false;
    b.sep.hidden = false;
    b.resolved.textContent = bits.map((r) => `“${r.phrase}” · ${r.date}${r.alt ? ` or ${r.alt}` : ''}`).join(' · ');
  }
  if (context.now) addNote(b, 'now', `${context.now} · ${context.tz || tz}`);
  for (const r of bits) addNote(b, 'date', `“${r.phrase}” · ${r.date}${r.alt ? ` or ${r.alt}` : ''}`);
  for (const m of (context.matched || [])) addNote(b, 'recall', `${m.date} · “${m.user}”`);
  const matched = Array.isArray(context.matched) ? context.matched : [];
  const prior = b.resolved.hidden ? '' : b.resolved.textContent.trim();
  const memory = [];
  if (context.explain) memory.push(context.explain);
  else if (matched.length) memory.push(`Recalled ${matched.length} earlier turn${matched.length === 1 ? '' : 's'}`);
  if (context.noMatch) memory.push('No matching earlier turn');
  if (memory.length) {
    b.resolved.hidden = false;
    b.sep.hidden = false;
    b.resolved.textContent = [prior, ...memory].filter(Boolean).join(' · ');
  }
  if (context.explain) addNote(b, 'memory', context.explain);
  if (context.trimmed) addNote(b, 'context', `${context.trimmed} older turn${context.trimmed === 1 ? '' : 's'} compressed${context.summarized != null ? ` (${context.summarized} shown)` : ''}`);
  if (context.noMatch) addNote(b, 'recall', 'No matching history');
  if (context.recheck) addNote(b, 'recheck', `${context.prefetch} earlier claim${context.prefetch === 1 ? '' : 's'} pre-checked`);
}

function claimDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : dateShort(d);
}

function renderVerdicts(b, checks, sources = {}) {
  if (!Array.isArray(checks) || !checks.length) {
    b.verdicts.hidden = true;
    return;
  }
  b.verdicts.hidden = false;
  b.verdicts.innerHTML = '';
  b.verdicts.append(el('div', 'sec-label', 'Re-check'));
  const list = el('ul', 'verdict-list');
  for (const c of checks.slice(0, 8)) {
    const kind = c.verdict === 'changed' || c.verdict === 'unchanged' ? c.verdict : 'unverified';
    const li = el('li', `verdict ${kind}`);
    li.append(el('span', 'verdict-kind', kind === 'changed' ? 'Changed' : kind === 'unchanged' ? 'Unchanged' : "Couldn't verify"));
    li.append(el('span', 'verdict-entity', c.entity || ''));
    if (c.note) li.append(el('span', 'verdict-note', c.note));
    const s = c.source ? sources[c.source] : null;
    if (s) {
      const title = s.title || hostOf(s.url);
      const cite = el('button', 'cite', String(c.source));
      cite.type = 'button';
      cite.dataset.url = safeUrl(s.url);
      cite.dataset.title = title;
      cite.dataset.host = hostOf(s.url);
      cite.dataset.pub = s.published || '';
      cite.setAttribute('aria-label', `Source ${c.source}: ${title}`);
      cite.title = title;
      li.append(cite);
    }
    list.append(li);
  }
  b.verdicts.append(list);
}

function renderClaims(b, claims) {
  if (!Array.isArray(claims) || !claims.length) {
    b.claims.hidden = true;
    return;
  }
  b.claims.hidden = false;
  b.claimList.innerHTML = '';
  for (const c of claims.slice(0, 8)) {
    const li = el('li', 'claim');
    li.append(el('span', 'asof', c.as_of ? `as of ${claimDate(c.as_of)}` : 'date unknown'));
    const txt = el('span', 'txt');
    txt.innerHTML = `<b>${esc(c.entity || '')}</b> — ${esc(c.claim || '')}`;
    li.append(txt);
    if (c.check_query) li.title = `Would be checked with: ${c.check_query}`;
    b.claimList.append(li);
  }
  b.claimsLabel.textContent = `Claims logged · ${claims.length}`;
}

function sourceQuality(url, title = '') {
  const host = hostOf(url).toLowerCase();
  const text = String(title).toLowerCase();
  if (/^(docs|developer|developers|support|help)\./.test(host) || /(^|\.)(github\.com|npmjs\.com|pypi\.org)$/.test(host) || /(changelog|release|documentation|docs)/.test(text)) return 'primary';
  if (/(news|blog|medium|substack|reddit|quora|verge|techcrunch|wired)/.test(host) || /(news|announcement)/.test(text)) return 'news';
  if (/(blog|medium|substack)/.test(host)) return 'blog';
  return 'web';
}

function sourceFreshness(published) {
  if (!published) return 'undated';
  const date = new Date(`${published}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'undated';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0) return `dated ${dateShort(date)} ${date.getFullYear()}`;
  if (days <= 90) return `fresh · ${dateShort(date)}`;
  if (days <= 730) return `updated ${dateShort(date)} ${date.getFullYear()}`;
  return `older · ${dateShort(date)} ${date.getFullYear()}`;
}

async function checkSource(button, li, b, source) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Checking';
  button.removeAttribute('data-state');
  try {
    const r = await fetch('/api/source-check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: source.url }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const result = await r.json();
    li.dataset.link = result.ok ? 'ok' : 'bad';
    button.dataset.state = result.ok ? 'ok' : 'bad';
    button.textContent = result.ok ? 'Reachable' : 'Unavailable';
    li.querySelector('.src-retry').hidden = !!result.ok;
    b.srcChecked.textContent = `Last checked ${dateStr(new Date())} ${timeStr(new Date())}.`;
    if (!result.ok) toast(`Source unavailable${result.status ? ` (HTTP ${result.status})` : ''}. Re-search is available.`, { type: 'error' });
  } catch (e) {
    li.dataset.link = 'bad';
    button.dataset.state = 'bad';
    button.textContent = 'Check failed';
    li.querySelector('.src-retry').hidden = false;
    toast(`Could not check source: ${e.message}`, { type: 'error' });
  } finally {
    button.disabled = false;
    if (button.dataset.state !== 'ok' && button.dataset.state !== 'bad') button.textContent = label;
  }
}

function renderSources(b, sources, text, seen = sourceSeen, checkedAt = new Date()) {
  if (!Array.isArray(sources) || !sources.length) {
    b.sources.hidden = true;
    b.currentSources = [];
    return;
  }
  const cited = sources.filter((s) => new RegExp(`\\[${s.id}\\]`).test(text || ''));
  const list = cited.length ? cited : sources;
  const unique = list.filter((s) => safeUrl(s.url) && !seen.has(s.url));
  const duplicates = list.length - unique.length;
  b.currentSources = list;
  b.sources.hidden = false;
  b.srcLabel.textContent = `Sources · ${unique.length}${duplicates ? ` · ${duplicates} seen earlier` : ''}${cited.length ? '' : ' · not cited inline'}`;
  b.srcList.innerHTML = '';
  b.srcList.hidden = unique.length === 0;
  b.srcNote.hidden = duplicates === 0;
  b.srcNote.textContent = unique.length
    ? `${duplicates} source${duplicates === 1 ? '' : 's'} already listed earlier in this chat.`
    : 'All sources for this answer were already listed earlier in this chat.';
  b.srcCopy.textContent = list.length === 1 ? 'Copy source' : `Copy ${list.length} sources`;
  b.srcCopy.onclick = async () => {
    const ok = await copyText(list.map((s) => `[${s.id}] ${s.title || hostOf(s.url)} - ${s.url}`).join('\n'));
    toast(ok ? 'Source list copied.' : 'Could not copy the source list.', { type: ok ? 'info' : 'error' });
  };
  for (const s of unique) {
    const li = el('li', 'src');
    li.dataset.url = s.url;
    li.append(el('span', 'src-num', `[${s.id}]`));
    const body = el('div');
    const a = el('a', '', s.title || hostOf(s.url));
    a.href = safeUrl(s.url) || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = s.title || s.url || '';
    body.append(a);
    body.append(el('div', 'src-meta', `${hostOf(s.url)} · ${sourceQuality(s.url, s.title)} · ${sourceFreshness(s.published)}`));
    const actions = el('div', 'src-actions');
    const check = el('button', 'src-check', 'Check link');
    check.type = 'button';
    check.addEventListener('click', () => checkSource(check, li, b, s));
    const retry = el('button', 'src-retry', 'Re-search');
    retry.type = 'button';
    retry.hidden = true;
    retry.addEventListener('click', () => {
      if (busy) return;
      ask(`This source is unavailable: ${s.title || hostOf(s.url)} (${s.url}). Find a current replacement and re-check the related claim.`);
    });
    actions.append(check, retry);
    body.append(actions);
    li.append(body, icon(EXT, 13));
    b.srcList.append(li);
  }
  const d = parseTs(checkedAt);
  b.srcChecked.textContent = `Source links checked ${dateStr(d)}. Use Check link for current status.`;
}
function metaParts(base, extra = []) {
  const parts = [];
  if (settings.timestamps !== false && base) parts.push(base);
  for (const x of extra) if (x) parts.push(x);
  return parts.join(' · ');
}

function historyMeta(t) {
  const src = (t.sources || []).length;
  const cl = (t.claims || []).length;
  return metaParts(timeStr(parseTs(t.ts)), [
    `${src} source${src === 1 ? '' : 's'}`,
    `${cl} claim${cl === 1 ? '' : 's'}`,
  ]);
}

function liveMeta(e) {
  const parts = [timeStr(new Date())];
  if (e.ttftMs != null) parts.push(`${(e.ttftMs / 1000).toFixed(1)}s to first token`);
  parts.push(`${(e.totalMs / 1000).toFixed(1)}s total`);
  parts.push(`${e.searches} search${e.searches === 1 ? '' : 'es'}`);
  return metaParts(parts[0], parts.slice(1));
}

function actionButton(label, onClick, opts = {}) {
  const b = el('button', `msg-action${opts.danger ? ' danger' : ''}`);
  b.type = 'button';
  b.append(label);
  b.addEventListener('click', onClick);
  return b;
}

function addActions(b, getText, getPrompt, turnId, isLast = false) {
  b.actions.hidden = false;
  b.actions.innerHTML = '';
  b.actions.append(actionButton('Copy', async () => {
    const ok = await copyText(getText());
    toast(ok ? 'Answer copied.' : 'Could not copy to clipboard.', { type: ok ? 'info' : 'error' });
  }));
  b.actions.append(actionButton('Retry', () => {
    if (busy) return;
    const prompt = getPrompt();
    if (prompt) ask(prompt);
  }));
  if (isLast && turnId) {
    b.actions.append(actionButton('Regenerate', () => regenerate(b, getPrompt())));
  }
  if (turnId) {
    b.actions.append(actionButton('Delete', () => deleteTurn(b, turnId), { danger: true }));
  }
}

async function regenerate(b, prompt) {
  if (busy || !prompt) return;
  if (b.turnId) {
    try {
      const r = await fetch(`/api/turns/${encodeURIComponent(b.turnId)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`Delete failed (${r.status})`);
      b.userNode?.remove();
      b.msg.remove();
      sourceSeen = new Set($$('.src').map((li) => li.dataset.url).filter(Boolean));
      toast('Regenerating the last answer.');
      loadConversations(true);
    } catch (e) {
      toast(`Could not regenerate: ${e.message}`, { type: 'error' });
      return;
    }
  }
  if (!wrap.querySelector('.msg')) emptyState();
  ask(prompt);
}

function emptyState() {
  wrap.innerHTML = '';
  const d = new Date();
  const box = el('div', 'empty');
  box.append(el('h2', 'empty-date', `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`));
  box.append(el('div', 'empty-year', `${d.getFullYear()} · ${tz}`));
  box.append(el('p', '', 'Minimi keeps the dates of what you ask, and checks whether the answer still holds. Ask about now, or pick up an earlier thread.'));
  const slips = el('div', 'slips');
  const prompts = [
    ['DATE', 'What did I ask you on 3 November, and is that still true today?'],
    ['CHANGE', 'Did we compare Postgres hosts last Tuesday? Has any pricing changed since?'],
    ['MEMORY', 'What did we shortlist for the CRM review on Monday?'],
  ];
  for (const [label, text] of prompts) {
    const b = el('button', 'slip');
    b.type = 'button';
    b.append(el('span', 'slip-date', label), el('span', 'slip-text', text), icon(ARROW, 13));
    b.addEventListener('click', () => ask(text));
    slips.append(b);
  }
  box.append(slips);
  wrap.append(box);
  updateJump();
}

function loadingState() {
  wrap.innerHTML = '';
  const box = el('div', 'empty');
  box.append(el('h2', 'empty-date', '—'));
  box.append(el('div', 'empty-year', 'Reading this entry'));
  box.append(el('p', '', 'Pulling the dated turns from this device.'));
  wrap.append(box);
}

function showLogError(message, onRetry) {
  wrap.innerHTML = '';
  const box = el('div', 'log-error');
  box.append(el('p', '', message));
  const b = el('button', 'retry', 'Try again');
  b.type = 'button';
  b.addEventListener('click', onRetry);
  box.append(b);
  wrap.append(box);
  live.textContent = 'Could not load this conversation.';
  updateJump();
}

async function loadHistory() {
  const seq = ++historySeq;
  recall = [];
  recallIdx = 0;
  recallDraft = '';
  loadingState();
  const p = (async () => {
    let hist;
    try {
      const r = await fetch(`/api/history?conv=${encodeURIComponent(conv)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Could not load this conversation (${r.status}).`);
      hist = await r.json();
    } catch (err) {
      if (seq !== historySeq) return;
      showLogError(err.message || 'Could not load this conversation.', () => loadHistory());
      return;
    }
    if (seq !== historySeq) return;
    wrap.innerHTML = '';
    if (!Array.isArray(hist) || !hist.length) {
      emptyState();
      return;
    }
    recall = hist.map((t) => t.user).filter(Boolean);
    recallIdx = recall.length;
    if (!findConv(conv) && hist[0]?.user) {
      fallbackTitle = hist[0].user.slice(0, 70);
      refreshHeader();
    }
    let day = '';
    let previousUser = null;
    sourceSeen = new Set();
    for (let i = 0; i < hist.length; i++) {
      const t = hist[i];
      const isLast = i === hist.length - 1;
      const d = parseTs(t.ts);
      const key = isoDate(d);
      if (key !== day) {
        day = key;
        const sep = el('div', 'date-sep');
        sep.append(el('span', '', dateStr(d)));
        wrap.append(sep);
      }
      const user = addUser(t.user, t.ts);
      const b = addBot();
      b.working.remove();
      b.userNode = user;
      b.turnId = t.id || '';
      b.rawText = t.assistant || '';
      const src = Object.fromEntries((t.sources || []).map((s) => [s.id, s]));
      b.body.innerHTML = formatRich(b.rawText || '(no answer)', src);
      b.meta.textContent = historyMeta(t);
      renderSources(b, t.sources || [], b.rawText, sourceSeen, t.ts);
      for (const s of (t.sources || [])) if (s.url) sourceSeen.add(s.url);
      renderVerdicts(b, t.verdicts || [], src);
      renderClaims(b, t.claims || []);
      addActions(b, () => b.rawText, () => t.user, b.turnId, isLast);
      attachUserActions(user, () => t.user, () => b.turnId, () => b, isLast);
      previousUser = user;
    }
    const last = hist[hist.length - 1];
    if (last?.ts) previousUser?.setAttribute('data-ts', last.ts);
    stick = true;
    unread = 0;
    scrollBottom(true);
  })();
  historyPromise = p;
  try { await p; } finally { if (historyPromise === p) historyPromise = null; }
}

function scrollBottom(force = false) {
  if (!force && !stick) return;
  requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
    stick = true;
    unread = 0;
    updateJump();
  });
}

function updateJump() {
  if (!jump) return;
  const hasMessages = !!wrap.querySelector('.msg');
  jump.hidden = stick || !hasMessages;
  if (!jump.hidden) jumpCount.textContent = unread ? String(unread) : 'Latest';
}

log?.addEventListener('scroll', () => {
  stick = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  if (stick) unread = 0;
  updateJump();
});
jump?.addEventListener('click', () => scrollBottom(true));

function sizeQ() {
  if (!q) return;
  q.style.height = 'auto';
  q.style.height = Math.min(q.scrollHeight, 220) + 'px';
}

function syncSend() {
  if (!send) return;
  if (busy) {
    send.disabled = false;
    send.classList.add('is-busy');
    send.setAttribute('aria-label', 'Stop generating');
  } else {
    send.classList.remove('is-busy');
    send.disabled = !q.value.trim();
    send.setAttribute('aria-label', 'Send message');
  }
}

function setBusy(value) {
  busy = value;
  syncSend();
  if (value) log.setAttribute('aria-busy', 'true');
  else log.removeAttribute('aria-busy');
}

let toastSeq = 0;
function toast(message, opts = {}) {
  const id = ++toastSeq;
  const node = el('div', 'toast');
  node.dataset.id = String(id);
  node.append(el('div', 'toast-text', message));
  let timer = 0;
  const close = () => {
    clearTimeout(timer);
    node.remove();
  };
  if (opts.actionLabel && typeof opts.onAction === 'function') {
    const action = el('button', 'toast-action', opts.actionLabel);
    action.type = 'button';
    action.addEventListener('click', () => {
      close();
      opts.onAction();
    });
    node.append(action);
  }
  const x = el('button', 'toast-close');
  x.type = 'button';
  x.setAttribute('aria-label', 'Dismiss notification');
  x.append(icon('M4 4l8 8M12 4l-8 8', 12));
  x.addEventListener('click', close);
  node.append(x);
  toasts.append(node);
  while (toasts.children.length > 3) toasts.firstElementChild?.remove();
  timer = setTimeout(close, opts.duration || (opts.type === 'error' ? 8000 : 5200));
  return { node, close };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = el('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

function openConfirm({ title, body, ok = 'Delete' }) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmBody.textContent = body;
    confirmOk.textContent = ok;
    confirmDialog.returnValue = '';
    const onClose = () => {
      confirmDialog.removeEventListener('close', onClose);
      resolve(confirmDialog.returnValue === 'confirm');
    };
    confirmDialog.addEventListener('close', onClose);
    confirmDialog.showModal();
  });
}

function closeMenu() {
  $$('.popover-menu').forEach((m) => m.remove());
  $$('[aria-expanded="true"][aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function openMenu(anchor, items) {
  closeMenu();
  const menu = el('div', 'popover-menu');
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    if (item.sep) {
      menu.append(el('div', 'menu-sep'));
      continue;
    }
    const b = el('button', item.danger ? 'danger' : '');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = item.label;
    b.addEventListener('click', () => {
      closeMenu();
      item.onSelect?.();
    });
    menu.append(b);
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  let left = Math.min(innerWidth - mr.width - 8, Math.max(8, r.right - mr.width));
  let top = r.bottom + 4;
  if (top + mr.height > innerHeight - 8) top = Math.max(8, r.top - mr.height - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  menu.addEventListener('keydown', (e) => {
    const buttons = $$('button', menu);
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      anchor.focus();
    } else if (e.key === 'Tab') {
      setTimeout(closeMenu, 0);
    }
  });
  $$('button', menu)[0]?.focus();
}

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.popover-menu') && !e.target.closest('[aria-haspopup="menu"]')) closeMenu();
});

function openChatMenu(anchor) {
  const meta = findConv(conv);
  const items = [
    { label: 'Rename', onSelect: startHeaderRename },
    { label: meta?.pinned ? 'Unpin' : 'Pin', onSelect: () => patchConv(conv, { pinned: !meta?.pinned }) },
    { label: meta?.archived ? 'Unarchive' : 'Archive', onSelect: () => patchConv(conv, { archived: !meta?.archived }) },
    { label: 'Export chat', onSelect: () => exportConversation(conv) },
    { sep: true },
    { label: 'Delete chat', danger: true, onSelect: () => deleteConversation(conv) },
  ];
  openMenu(anchor, items);
}

$('#chatMenuBtn')?.addEventListener('click', (e) => openChatMenu(e.currentTarget));

async function deleteConversation(id) {
  const item = findConv(id);
  if (!item) return;
  const ok = await openConfirm({
    title: 'Delete chat?',
    body: `“${item.title || 'Untitled entry'}” and its dated turns will be removed.`,
    ok: 'Delete',
  });
  if (!ok) return;
  const previousCurrent = conv;
  deletingIds.add(id);
  convs = convs.filter((c) => c.id !== id);
  renderRailSafe();
  if (conv === id) newChat(false);
  else refreshHeader();
  const timer = setTimeout(async () => {
    deletingIds.delete(id);
    try {
      const r = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`Delete failed (${r.status})`);
      delete drafts[id];
      persistDrafts();
      toast('Chat deleted.');
    } catch (e) {
      toast(`Could not delete chat: ${e.message}`, { type: 'error' });
      loadConversations(true);
    }
  }, 7000);
  toast(`Deleted “${item.title || 'Untitled entry'}”.`, {
    actionLabel: 'Undo',
    duration: 7000,
    onAction: () => {
      clearTimeout(timer);
      deletingIds.delete(id);
      convs = [...convs, item];
      renderRailSafe();
      refreshHeader();
      if (previousCurrent === id) switchTo(id);
      toast('Chat restored.');
    },
  });
}

async function deleteTurn(b, turnId) {
  if (!turnId) return;
  const ok = await openConfirm({
    title: 'Delete this turn?',
    body: 'The question and answer will be removed from this conversation. This cannot be undone.',
    ok: 'Delete',
  });
  if (!ok) return;
  try {
    const r = await fetch(`/api/turns/${encodeURIComponent(turnId)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`Delete failed (${r.status})`);
    b.userNode?.remove();
    b.msg.remove();
    toast('Turn deleted.');
    loadConversations(true);
    if (!wrap.querySelector('.msg')) emptyState();
  } catch (e) {
    toast(`Could not delete turn: ${e.message}`, { type: 'error' });
  }
}

function stopGeneration(silent = false) {
  if (!busy) return;
  ac?.abort();
  if (!silent) live.textContent = 'Generation stopped.';
}

function showError(b, message, onRetry) {
  b.working.hidden = true;
  b.typing.hidden = true;
  b.status.hidden = true;
  b.body.querySelector('.error-block')?.remove();
  const block = el('div', 'error-block');
  block.append(el('p', 'error-msg', `Something went wrong: ${message || 'the request failed.'}`));
  if (onRetry) {
    const btn = el('button', 'retry', 'Try again');
    btn.type = 'button';
    btn.addEventListener('click', onRetry);
    block.append(btn);
  }
  b.body.append(block);
  live.textContent = 'Something went wrong.';
}

async function ask(message, edit = null) {
  const textMessage = String(message || '').trim();
  if (!textMessage || busy) return;
  if (!navigator.onLine) {
    toast('You are offline. Reconnect to send messages.', { type: 'error' });
    return;
  }
  if (edit) {
    if (edit.turnId) {
      try {
        const r = await fetch(`/api/turns/${encodeURIComponent(edit.turnId)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 404) throw new Error(`Delete failed (${r.status})`);
      } catch (e) {
        toast(`Could not edit this turn: ${e.message}`, { type: 'error' });
        return;
      }
    }
    edit.userNode?.remove();
    edit.bot?.msg.remove();
    pendingEdit = null;
    setComposerHint();
    sourceSeen = new Set($$('.src').map((li) => li.dataset.url).filter(Boolean));
    loadConversations(true);
    if (!wrap.querySelector('.msg')) emptyState();
  }
  setBusy(true);
  ac = new AbortController();
  const controller = ac;
  while (historyPromise) {
    const p = historyPromise;
    try { await p; } catch {}
    if (historyPromise === p) historyPromise = null;
  }
  if (wrap.querySelector('.empty, .log-error')) wrap.innerHTML = '';
  stick = true;
  unread = 0;
  live.textContent = 'Working.';
  q.value = '';
  delete drafts[conv];
  persistDrafts();
  sizeQ();
  syncSend();
  if (isMobile()) q.blur();
  fallbackTitle = fallbackTitle || textMessage.slice(0, 70);
  const userNode = addUser(textMessage);
  if (recall[recall.length - 1] !== textMessage) recall.push(textMessage);
  recallIdx = recall.length;
  recallDraft = '';
  const b = addBot();
  b.userNode = userNode;
  b.rawText = '';
  addActions(b, () => b.rawText, () => textMessage, '');
  b.actions.hidden = true;
  attachUserActions(userNode, () => textMessage, () => b.turnId, () => b, true);
  scrollBottom(true);
  refreshHeader();
  const retry = () => {
    if (busy) return;
    b.userNode?.remove();
    b.msg.remove();
    if (!wrap.querySelector('.msg')) emptyState();
    ask(textMessage);
  };
  let text = '';
  let sources = {};
  let raf = 0;
  let settled = false;
  let stopped = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    setBusy(false);
    ac = null;
    if (stopped) {
      b.working.hidden = true;
      if (!b.body.querySelector('.stopped') && b.body.textContent.trim()) {
        b.body.append(el('div', 'stopped', 'Stopped'));
      }
      if (!b.body.textContent.trim()) {
        b.body.append(el('div', 'stopped', 'Stopped before an answer arrived'));
      }
      b.meta.textContent = metaParts(timeStr(new Date()));
      renderSources(b, Object.values(sources), text);
      for (const s of Object.values(sources)) if (s.url) sourceSeen.add(s.url);
      addActions(b, () => b.rawText || text, () => textMessage, b.turnId, true);
      live.textContent = 'Generation stopped.';
    }
    if (!isMobile() && document.visibilityState === 'visible' && !document.querySelector('dialog[open]') && !document.body.classList.contains('nav-open')) q.focus();
    loadConversations(true);
  };
  const paint = () => {
    raf = 0;
    b.body.innerHTML = formatRich(text, sources);
    b.rawText = text;
    scrollBottom();
  };
  const flush = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const handle = (e) => {
    if (e.type === 'context') setResolved(b, e.data);
    else if (e.type === 'status') {
      setStatus(b, e.text);
      addNote(b, 'search', e.text);
      live.textContent = e.text;
    } else if (e.type === 'sources') {
      for (const s of e.sources || []) sources[s.id] = s;
      if (text) flush();
    } else if (e.type === 'text') {
      if (!b.firstText) {
        b.firstText = true;
        b.working.hidden = true;
        live.textContent = 'Answer streaming.';
      }
      text += e.delta || '';
      b.rawText = text;
      flush();
    } else if (e.type === 'done') {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (typeof e.answer === 'string') text = e.answer;
      b.working.hidden = true;
      b.turnId = e.turnId || '';
      b.body.innerHTML = formatRich(text, sources);
      b.rawText = text;
      b.meta.textContent = liveMeta(e);
      renderSources(b, Object.values(sources), text);
      for (const s of Object.values(sources)) if (s.url) sourceSeen.add(s.url);
      addActions(b, () => b.rawText, () => textMessage, b.turnId, true);
      const srcCount = Object.keys(sources).length;
      live.textContent = `Answer ready. ${srcCount} source${srcCount === 1 ? '' : 's'} available.`;
      scrollBottom();
      finish();
    } else if (e.type === 'verdicts') {
      renderVerdicts(b, e.checks, sources);
      const count = Array.isArray(e.checks) ? e.checks.length : 0;
      if (count) live.textContent = `Answer ready. ${count} re-check${count === 1 ? '' : 's'} reported.`;
      scrollBottom();
    } else if (e.type === 'claims') {
      renderClaims(b, e.claims);
      const count = Array.isArray(e.claims) ? e.claims.length : 0;
      live.textContent = `Answer ready. ${count} claim${count === 1 ? '' : 's'} logged for later checking.`;
    } else if (e.type === 'error') {
      showError(b, e.message, retry);
      finish();
    }
  };
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: textMessage, conv, tz }),
      signal: controller.signal,
    });
    if (!r.ok || !r.body) {
      const info = await r.json().catch(() => null);
      throw new Error(info?.error || `Request failed (${r.status})`);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let index;
      while ((index = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, index).trim();
        buf = buf.slice(index + 1);
        if (!line) continue;
        try { handle(JSON.parse(line)); } catch {}
      }
    }
    if (!settled) {
      b.working.hidden = true;
      if (text) {
        b.body.innerHTML = formatRich(text, sources);
        b.rawText = text;
        renderSources(b, Object.values(sources), text);
        b.meta.textContent = metaParts(timeStr(new Date()));
        addActions(b, () => b.rawText, () => textMessage, b.turnId, true);
        showError(b, 'The stream ended before the answer finished.', retry);
      } else {
        showError(b, 'The stream ended before an answer arrived.', retry);
      }
      finish();
    }
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      stopped = true;
      if (!settled) {
        b.working.hidden = true;
        if (text) {
          b.body.innerHTML = formatRich(text, sources);
          b.rawText = text;
          renderSources(b, Object.values(sources), text);
        }
        finish();
      }
      return;
    }
    if (!settled) {
      showError(b, err.message, retry);
      finish();
    }
  } finally {
    if (ac === controller) ac = null;
    if (!settled) finish();
    if (text) scrollBottom();
  }
}

function updateOnline() {
  if (!offlineBanner) return;
  const offline = !navigator.onLine;
  offlineBanner.hidden = !offline;
  offlineBanner.textContent = offline
    ? 'You are offline. Reconnect to send messages.'
    : 'You are back online.';
  if (!offline) setTimeout(() => { offlineBanner.hidden = true; }, 2400);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
window.addEventListener('pagehide', saveDraft);

q?.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Escape' && pendingEdit) {
    e.preventDefault();
    cancelEdit(true);
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
    if (settings.enterSend !== false && !isNarrow()) {
      e.preventDefault();
      $('#f')?.requestSubmit();
    }
    return;
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $('#f')?.requestSubmit();
    return;
  }
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowUp') {
    if (!recall.length) return;
    if (recallIdx === recall.length) {
      if (q.value.trim()) return;
      recallDraft = q.value;
    }
    e.preventDefault();
    recallIdx = Math.max(0, recallIdx - 1);
    q.value = recall[recallIdx] || '';
    q.setSelectionRange(q.value.length, q.value.length);
    sizeQ();
  } else if (e.key === 'ArrowDown') {
    if (recallIdx >= recall.length) return;
    e.preventDefault();
    recallIdx = Math.min(recall.length, recallIdx + 1);
    q.value = recallIdx === recall.length ? recallDraft : (recall[recallIdx] || '');
    q.setSelectionRange(q.value.length, q.value.length);
    sizeQ();
  }
});

q?.addEventListener('input', () => {
  recallIdx = recall.length;
  recallDraft = '';
  sizeQ();
  syncSend();
  saveDraft();
});

$('#f')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) {
    stopGeneration();
    return;
  }
  const message = q.value.trim();
  if (message) ask(message, pendingEdit);
});

const pop = el('div', 'pop');
pop.setAttribute('role', 'tooltip');
document.body.append(pop);
let popTimer = 0;
function showPop(btn) {
  clearTimeout(popTimer);
  pop.innerHTML = `<div class="p-title">${esc(btn.dataset.title || btn.dataset.url || '')}</div><div class="p-meta">${esc(btn.dataset.host || '')}${btn.dataset.pub ? ` · ${esc(btn.dataset.pub)}` : ''}</div>`;
  pop.dataset.open = 'true';
  const r = btn.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const left = Math.min(window.innerWidth - 12 - pr.width, Math.max(12, r.left + r.width / 2 - pr.width / 2));
  let top = r.top - pr.height - 8;
  if (top < 12) top = r.bottom + 8;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
const hidePop = () => { pop.dataset.open = 'false'; };
document.addEventListener('mouseover', (e) => {
  const c = e.target.closest('.cite');
  if (c) showPop(c);
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('.cite')) popTimer = setTimeout(hidePop, 120);
});
document.addEventListener('focusin', (e) => {
  const c = e.target.closest('.cite');
  if (c) showPop(c);
});
document.addEventListener('focusout', (e) => {
  if (e.target.closest('.cite')) hidePop();
});
window.addEventListener('scroll', hidePop, true);

wrap?.addEventListener('click', async (e) => {
  const copy = e.target.closest('.copy-code');
  if (copy) {
    const text = copy.dataset.code || '';
    const ok = await copyText(text);
    copy.textContent = ok ? 'Copied' : 'Failed';
    copy.dataset.copied = String(ok);
    setTimeout(() => {
      copy.textContent = 'Copy';
      delete copy.dataset.copied;
    }, 1400);
    return;
  }
  const cite = e.target.closest('.cite');
  if (cite) {
    const url = safeUrl(cite.dataset.url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
});

async function loadStatus() {
  const provider = $('#providerSetting');
  const models = $('#modelSetting');
  try {
    const r = await fetch('/api/status', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const status = await r.json();
    if (provider) {
      provider.textContent = `${status.provider || 'provider'} · ${status.configured?.model ? 'ready' : 'key missing'} · ${status.search || 'search'}`;
      provider.title = `${status.auth || 'auth seam'} · ${status.configured?.search ? 'search key set' : 'search key missing'}`;
    }
    if (models) {
      models.textContent = `${status.models?.main || 'main'} · fast ${status.models?.fast || 'fast'}`;
      models.title = `Message limit ${status.limits?.messageChars || 4000} · ${status.limits?.turnsPerConversation || 200} turns per chat`;
    }
  } catch (e) {
    if (provider) provider.textContent = 'Status unavailable';
    if (models) models.textContent = 'Status unavailable';
    if (provider) provider.title = e.message;
  }
}

function openSettings(tab = 'general') {
  if (!settingsDialog) return;
  selectSettingsTab(tab);
  if (!settingsDialog.open) settingsDialog.showModal();
  loadStatus();
}

function selectSettingsTab(tab) {
  const id = `panel-${tab}`;
  $$('.settings-tabs [role="tab"]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.getAttribute('aria-controls') === id));
  });
  $$('.settings-panel').forEach((p) => { p.hidden = p.id !== id; });
}

$$('.settings-tabs [role="tab"]').forEach((b) => {
  b.addEventListener('click', () => selectSettingsTab(b.getAttribute('aria-controls').replace('panel-', '')));
  b.addEventListener('keydown', (e) => {
    const tabs = $$('.settings-tabs [role="tab"]');
    const i = tabs.indexOf(b);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    }
  });
});

$('#settingsClose')?.addEventListener('click', () => settingsDialog.close());
$('#openShortcuts')?.addEventListener('click', () => {
  settingsDialog.close();
  openShortcuts();
});
$('#shortcutsClose')?.addEventListener('click', () => shortcutsDialog.close());
settingsDialog?.addEventListener('click', (e) => { if (e.target === settingsDialog) settingsDialog.close(); });
shortcutsDialog?.addEventListener('click', (e) => { if (e.target === shortcutsDialog) shortcutsDialog.close(); });

function openShortcuts() {
  if (!shortcutsDialog.open) shortcutsDialog.showModal();
}

function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchHistory(id) {
  const r = await fetch(`/api/history?conv=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`History unavailable (${r.status})`);
  return r.json();
}

async function exportConversation(id = conv) {
  const item = findConv(id);
  try {
    const turns = await fetchHistory(id);
    downloadJson(`minimi-${id.slice(0, 8)}.json`, {
      exportedAt: new Date().toISOString(),
      conversation: { id, title: item?.title || fallbackTitle || 'Untitled entry' },
      turns,
    });
    toast('Chat exported.');
  } catch (e) {
    toast(`Could not export chat: ${e.message}`, { type: 'error' });
  }
}

$('#exportAll')?.addEventListener('click', async () => {
  try {
    const list = convs.length ? convs : await (await fetch('/api/conversations', { cache: 'no-store' })).json();
    const conversations = await Promise.all(list.map(async (c) => ({
      ...c,
      turns: await fetchHistory(c.id).catch(() => []),
    })));
    downloadJson('minimi-export.json', { exportedAt: new Date().toISOString(), conversations });
    toast(`Exported ${conversations.length} chat${conversations.length === 1 ? '' : 's'}.`);
  } catch (e) {
    toast(`Could not export chats: ${e.message}`, { type: 'error' });
  }
});

$('#clearLocal')?.addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettings();
  toast('Preferences reset.');
});

$('#loadDemo')?.addEventListener('click', (e) => loadDemoHistory(e.currentTarget));

$('#clearAll')?.addEventListener('click', async () => {
  const ok = await openConfirm({
    title: 'Clear all chats?',
    body: 'Every conversation and dated turn on this device will be removed. This cannot be undone.',
    ok: 'Clear all',
  });
  if (!ok) return;
  try {
    const r = await fetch('/api/conversations', { method: 'DELETE' });
    if (!r.ok) throw new Error(`Clear failed (${r.status})`);
    convs = [];
    deletingIds.clear();
    newChat(false);
    drafts = {};
    persistDrafts();
    renderRailSafe();
    toast('All chats cleared.');
  } catch (e) {
    toast(`Could not clear chats: ${e.message}`, { type: 'error' });
  }
});

function isTypingTarget(target) {
  return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (document.querySelector('dialog[open]')) return;
    if (document.body.classList.contains('nav-open')) {
      closeNav();
      return;
    }
    closeMenu();
    hidePop();
    if (pendingEdit) {
      e.preventDefault();
      cancelEdit(true);
      return;
    }
    if (busy) {
      e.preventDefault();
      stopGeneration();
    }
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    newChat();
    return;
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (isMobile()) openNav();
    setTimeout(() => { search?.focus(); search?.select(); }, isMobile() ? 240 : 0);
    return;
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    if (isMobile()) {
      if (document.body.classList.contains('nav-open')) closeNav();
      else openNav();
    } else setRailHidden(!settings.railHidden);
    return;
  }
  if (isTypingTarget(e.target)) return;
  if (e.key === '?') {
    e.preventDefault();
    openShortcuts();
  } else if (e.key === '/') {
    e.preventDefault();
    q.focus();
  }
});

function tick() {
  const d = new Date();
  const day = $('#stampDay');
  const month = $('#stampMonth');
  if (day) day.textContent = pad(d.getDate());
  if (month) month.textContent = MO[d.getMonth()];
  const foot = $('#footZone');
  if (foot) foot.textContent = `${dateStr(d)} · ${tz}`;
}
setInterval(tick, 1000);

fillTimezones();
applySettings();
setComposerHint();
tick();
updateOnline();
loadStatus();
syncRail();
loadDraft();
refreshHeader();
renderRailSkeleton();
loadConversations();
loadHistory();
if (!isMobile()) setTimeout(() => q.focus(), 0);