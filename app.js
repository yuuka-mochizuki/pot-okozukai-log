/* ポット回収ログ */
'use strict';

const ENTRIES_KEY = 'potlog-entries';
const SETTINGS_KEY = 'potlog-settings';

const $ = id => document.getElementById(id);

let entries = loadEntries();
let settings = loadSettings();
let editingId = null;
let filterMenu = null;

function loadEntries() {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      price: typeof data.price === 'number' && isFinite(data.price) && data.price >= 0 ? data.price : 0,
      perUse: typeof data.perUse === 'number' && isFinite(data.perUse) && data.perUse > 0 ? data.perUse : 300,
    };
  } catch {
    return { price: 0, perUse: 300 };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function isValidEntry(e) {
  return e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
    && typeof e.menu === 'string' && e.menu.trim() !== ''
    && typeof e.amount === 'number' && isFinite(e.amount) && e.amount > 0;
}

function yen(n) {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---- render ---- */

function render() {
  renderProgress();
  renderMenuTotals();
  renderHistory();
  renderDatalist();
  $('inPrice').value = settings.price || '';
  $('inPerUse').value = settings.perUse;
}

function renderProgress() {
  const collected = entries.reduce((s, e) => s + e.amount, 0);
  const price = settings.price;
  const remaining = Math.max(0, price - collected);
  const pct = price > 0 ? Math.min(100, Math.round((collected / price) * 100)) : 0;

  $('collected').textContent = yen(collected);
  $('priceDisplay').textContent = yen(price);
  $('progressFill').style.transform = `scaleX(${price > 0 ? Math.min(1, collected / price) : 0})`;
  $('progressPercent').textContent = `${pct}%`;
  $('remainingLabel').textContent = price > 0 && remaining === 0 ? '' : `残り ${yen(remaining)}`;
  $('completeBanner').hidden = !(price > 0 && collected >= price);
}

function renderMenuTotals() {
  const box = $('menuTotals');
  box.innerHTML = '';
  const totals = new Map();
  for (const e of entries) {
    const t = totals.get(e.menu) || { count: 0 };
    t.count++;
    totals.set(e.menu, t);
  }
  $('menuHint').hidden = totals.size === 0;
  if (totals.size === 0) {
    box.innerHTML = '<p class="empty">まだ記録がありません。<br>上のフォームから最初の記録をつけましょう。</p>';
    return;
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1].count - a[1].count);
  const max = sorted[0][1].count;
  for (const [menu, t] of sorted) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'service-row' + (filterMenu === menu ? ' is-filtered' : '');
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.style.transform = `scaleX(${max > 0 ? t.count / max : 0})`;
    const name = document.createElement('span');
    name.className = 'service-name';
    name.textContent = menu;
    const count = document.createElement('span');
    count.className = 'service-amount';
    count.textContent = `${t.count}回`;
    row.append(bar, name, count);
    row.addEventListener('click', () => {
      filterMenu = filterMenu === menu ? null : menu;
      render();
    });
    box.appendChild(row);
  }
}

function renderHistory() {
  const box = $('historyList');
  box.innerHTML = '';

  const list = entries
    .filter(e => !filterMenu || e.menu === filterMenu)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  $('entryCount').textContent = `${list.length}件`;
  $('filterBar').hidden = !filterMenu;
  if (filterMenu) {
    $('filterLabel').textContent = `「${filterMenu}」で絞り込み中`;
  }

  if (list.length === 0) {
    box.innerHTML = '<p class="empty">表示する記録がありません。</p>';
    return;
  }

  let currentMonth = '';
  let monthBlock = null;
  for (const e of list) {
    const ym = e.date.slice(0, 7);
    if (ym !== currentMonth) {
      currentMonth = ym;
      const head = document.createElement('div');
      head.className = 'month-head';
      const [yy, mm] = ym.split('-');
      const label = document.createElement('span');
      label.textContent = `${yy}年${Number(mm)}月`;
      const total = document.createElement('span');
      total.className = 'month-total';
      const monthSum = list.filter(x => x.date.startsWith(ym)).reduce((s, x) => s + x.amount, 0);
      total.textContent = yen(monthSum);
      head.append(label, total);
      box.appendChild(head);
      monthBlock = document.createElement('div');
      box.appendChild(monthBlock);
    }
    monthBlock.appendChild(entryRow(e));
  }
}

function entryRow(e) {
  const row = document.createElement('div');
  row.className = 'entry-row';

  const date = document.createElement('span');
  date.className = 'entry-date';
  date.textContent = `${Number(e.date.slice(5, 7))}/${Number(e.date.slice(8, 10))}`;

  const main = document.createElement('div');
  main.className = 'entry-main';
  const menu = document.createElement('div');
  menu.className = 'entry-service';
  menu.textContent = e.menu;
  main.appendChild(menu);
  if (e.memo) {
    const memo = document.createElement('div');
    memo.className = 'entry-memo';
    memo.textContent = e.memo;
    main.appendChild(memo);
  }

  const amount = document.createElement('span');
  amount.className = 'entry-amount';
  amount.textContent = '+' + yen(e.amount);

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn';
  editBtn.textContent = '✏️';
  editBtn.title = '編集';
  editBtn.addEventListener('click', () => startEdit(e.id));
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'icon-btn danger';
  delBtn.textContent = '🗑';
  delBtn.title = '削除';
  delBtn.addEventListener('click', () => removeEntry(e.id));
  actions.append(editBtn, delBtn);

  row.append(date, main, amount, actions);
  return row;
}

function renderDatalist() {
  const dl = $('menuList');
  dl.innerHTML = '';
  const names = [...new Set(entries.map(e => e.menu))].sort();
  for (const n of names) {
    const opt = document.createElement('option');
    opt.value = n;
    dl.appendChild(opt);
  }
}

/* ---- form ---- */

function resetForm() {
  editingId = null;
  $('entryForm').reset();
  $('inDate').value = todayStr();
  $('formTitle').textContent = '使った記録をつける';
  $('submitBtn').textContent = `使った！（+${settings.perUse.toLocaleString('ja-JP')}円）`;
  $('cancelEditBtn').hidden = true;
}

function startEdit(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  $('inDate').value = e.date;
  $('inMenu').value = e.menu;
  $('inMemo').value = e.memo || '';
  $('formTitle').textContent = '記録を編集';
  $('submitBtn').textContent = '更新する';
  $('cancelEditBtn').hidden = false;
  $('entryForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`「${e.menu}」の記録を削除しますか？`)) return;
  entries = entries.filter(x => x.id !== id);
  if (editingId === id) resetForm();
  saveEntries();
  render();
}

$('entryForm').addEventListener('submit', ev => {
  ev.preventDefault();
  const entry = {
    id: editingId ?? Date.now(),
    date: $('inDate').value,
    menu: $('inMenu').value.trim(),
    memo: $('inMemo').value.trim(),
    amount: editingId !== null
      ? entries.find(x => x.id === editingId)?.amount ?? settings.perUse
      : settings.perUse,
  };
  if (!isValidEntry(entry)) return;
  if (editingId !== null) {
    entries = entries.map(e => (e.id === editingId ? entry : e));
  } else {
    entries.push(entry);
  }
  saveEntries();
  resetForm();
  render();
});

$('cancelEditBtn').addEventListener('click', resetForm);

$('clearFilterBtn').addEventListener('click', () => {
  filterMenu = null;
  render();
});

/* ---- settings ---- */

$('saveSettingsBtn').addEventListener('click', () => {
  const price = Math.max(0, Math.round(Number($('inPrice').value) || 0));
  const perUse = Math.max(1, Math.round(Number($('inPerUse').value) || 300));
  settings = { price, perUse };
  saveSettings();
  resetForm();
  render();
});

/* ---- export / import ---- */

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ settings, entries }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `potlog-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.entries;
    if (!Array.isArray(list)) throw new Error('形式が違います');
    const valid = list.filter(isValidEntry);
    if (valid.length === 0) throw new Error('有効な記録がありません');
    if (!confirm(`${valid.length}件の記録を読み込みます。現在のデータ（${entries.length}件）は置き換えられます。よろしいですか？`)) return;
    entries = valid;
    saveEntries();
    if (data.settings && typeof data.settings === 'object') {
      settings = {
        price: typeof data.settings.price === 'number' ? data.settings.price : settings.price,
        perUse: typeof data.settings.perUse === 'number' && data.settings.perUse > 0 ? data.settings.perUse : settings.perUse,
      };
      saveSettings();
    }
    resetForm();
    render();
  } catch (err) {
    alert('インポートに失敗しました: ' + err.message);
  }
});

/* ---- init ---- */

resetForm();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
