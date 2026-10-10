(function () {
  'use strict';

  /* ---------- Constants & helpers ---------- */
  var STORE_KEY = 'habitly.v1', THEME_KEY = 'habitly.theme';
  var DEFAULT_CATS = ['Health', 'Learning', 'Productivity', 'Mindfulness', 'Fitness', 'Other'];
  var COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  var ACTIVE = 'bg-indigo-600 text-white shadow-sm'.split(' ');
  var INACTIVE = 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-700/60'.split(' ');
  var CHECK = '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

  var memory = {};
  var storage = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return memory.hasOwnProperty(k) ? memory[k] : null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  };

  var state = { habits: [], log: {}, filterCat: 'All', filterStatus: 'all', period: 'week' };
  var editingId = null, formDays = [], formColor = COLORS[0], pendingConfirm = null, popId = null, toastTimer = null;
  var lastPct = {};

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayIdx(d) { return (d.getDay() + 6) % 7; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function weekStart(d) { return addDays(d, -dayIdx(d)); }
  function uid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Data layer ---------- */
  function isScheduled(h, d) { return h.days.indexOf(dayIdx(d)) !== -1; }
  function isDone(id, key) { return !!(state.log[id] && state.log[id][key]); }

  function save() { storage.set(STORE_KEY, JSON.stringify({ version: 1, habits: state.habits, log: state.log })); }

  function sanitize(d) {
    if (!d || !Array.isArray(d.habits)) return null;
    var habits = [], log = {}, ids = {};
    d.habits.forEach(function (h) {
      if (!h || typeof h.name !== 'string' || !h.name.trim()) return;
      var orig = typeof h.id === 'string' && h.id ? h.id : null;
      var id = orig && !ids[orig] ? orig : uid();
      ids[id] = true;
      var days = Array.isArray(h.days) ? h.days.filter(function (n, i, a) { return Number.isInteger(n) && n >= 0 && n <= 6 && a.indexOf(n) === i; }).sort() : [];
      habits.push({
        id: id,
        name: h.name.trim().slice(0, 60),
        category: typeof h.category === 'string' && h.category.trim() ? h.category.trim().slice(0, 24) : 'Other',
        days: days.length ? days : ALL_DAYS.slice(),
        color: typeof h.color === 'string' && /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : COLORS[0],
        created: typeof h.created === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.created) ? h.created : keyOf(today())
      });
      log[id] = {};
      if (orig === id && d.log && d.log[orig] && typeof d.log[orig] === 'object') {
        Object.keys(d.log[orig]).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && d.log[orig][k]) log[id][k] = true; });
      }
    });
    return { habits: habits, log: log };
  }

  function load() {
    var raw = storage.get(STORE_KEY);
    if (!raw) return false;
    try {
      var d = sanitize(JSON.parse(raw));
      if (d) { state.habits = d.habits; state.log = d.log; return true; }
    } catch (e) { /* fall through to seed */ }
    return false;
  }

  function seed() {
    var t = today(), created = keyOf(addDays(t, -30));
    var defs = [
      ['Drink 2L of water', 'Health', ALL_DAYS, '#0ea5e9'],
      ['Read 20 pages', 'Learning', ALL_DAYS, '#6366f1'],
      ['Morning workout', 'Fitness', [0, 2, 4], '#10b981'],
      ['Meditate for 10 minutes', 'Mindfulness', ALL_DAYS, '#8b5cf6'],
      ['Plan tomorrow', 'Productivity', [0, 1, 2, 3, 4], '#f59e0b']
    ];
    state.habits = defs.map(function (d, i) { return { id: 'seed' + (i + 1), name: d[0], category: d[1], days: d[2].slice(), color: d[3], created: created }; });
    state.log = {};
    state.habits.forEach(function (h, i) {
      var l = {};
      for (var n = 1; n <= 30; n++) {
        var d = addDays(t, -n);
        if (!isScheduled(h, d)) continue;
        if ((n + i * 3) % (7 + i * 2) === 0) continue;
        l[keyOf(d)] = true;
      }
      if (i < 2 && isScheduled(h, t)) l[keyOf(t)] = true;
      state.log[h.id] = l;
    });
    save();
  }

  function streakOf(h) {
    var n = 0, d = today();
    for (var i = 0; i < 1000; i++) {
      if (isScheduled(h, d)) {
        if (isDone(h.id, keyOf(d))) n++;
        else if (i !== 0) break;
      }
      d = addDays(d, -1);
    }
    return n;
  }

  function periodStats(h, period) {
    var t = today(), s, e;
    if (period === 'week') { s = weekStart(t); e = addDays(s, 6); }
    else { s = new Date(t.getFullYear(), t.getMonth(), 1); e = new Date(t.getFullYear(), t.getMonth() + 1, 0); }
    var total = 0, done = 0;
    for (var d = s; d <= e; d = addDays(d, 1)) {
      if (!isScheduled(h, d)) continue;
      var k = keyOf(d);
      if (isDone(h.id, k)) { done++; total++; }
      else if (k >= h.created) total++;
    }
    return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
  }

  function scheduleLabel(h) {
    var s = h.days.join(',');
    if (h.days.length === 7) return 'Every day';
    if (s === '0,1,2,3,4') return 'Weekdays';
    if (s === '5,6') return 'Weekends';
    return h.days.map(function (i) { return DAYS[i]; }).join(', ');
  }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 3200);
  }
  function openModal(el) { el.classList.remove('hidden'); el.classList.add('flex'); }
  function closeModal(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
  function closeAllModals() { ['#habitModal', '#dataModal', '#confirmModal'].forEach(function (s) { closeModal($(s)); }); pendingConfirm = null; }
  function askConfirm(title, msg, okLabel, fn) {
    $('#cTitle').textContent = title;
    $('#cMsg').textContent = msg;
    $('#cOk').textContent = okLabel;
    pendingConfirm = fn;
    openModal($('#confirmModal'));
  }
  function animateNumber(el, to) {
    var from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    cancelAnimationFrame(el._raf);
    if (from === to) { el.textContent = to + '%'; return; }
    var t0 = performance.now(), dur = 600;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e) + '%';
      if (p < 1) el._raf = requestAnimationFrame(step);
    })(t0);
  }
  function setSeg(sel, attr, val) {
    document.querySelectorAll(sel + ' button').forEach(function (b) {
      var on = b.dataset[attr] === val;
      ACTIVE.forEach(function (c) { b.classList.toggle(c, on); });
      INACTIVE.forEach(function (c) { b.classList.toggle(c, !on); });
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---------- Rendering ---------- */
  function renderSummary() {
    var t = today();
    $('#todayLabel').textContent = t.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var due = state.habits.filter(function (h) { return isScheduled(h, t); });
    var done = due.filter(function (h) { return isDone(h.id, keyOf(t)); }).length;
    var pct = due.length ? Math.round(done / due.length * 100) : 0;
    $('#overallBar').style.width = pct + '%';
    $('#overallTrack').setAttribute('aria-valuenow', pct);
    animateNumber($('#todayPct'), pct);
    var left = due.length - done;
    $('#todaySub').textContent = !state.habits.length ? 'Add your first habit to get started'
      : !due.length ? 'Nothing scheduled today. Enjoy the rest day.'
      : left === 0 ? 'All ' + due.length + ' done. Nice work!'
      : done + ' of ' + due.length + ' done, ' + left + ' to go';
    var best = 0, wd = 0, wt = 0;
    state.habits.forEach(function (h) {
      best = Math.max(best, streakOf(h));
      var s = periodStats(h, 'week'); wd += s.done; wt += s.total;
    });
    $('#statStreak').textContent = best ? best + (best === 1 ? ' day' : ' days') : '–';
    $('#statWeek').textContent = wt ? Math.round(wd / wt * 100) + '% (' + wd + '/' + wt + ')' : '–';
    $('#statTotal').textContent = state.habits.length;
  }

  function renderFilters() {
    var cats = ['All'];
    state.habits.forEach(function (h) { if (cats.indexOf(h.category) === -1) cats.push(h.category); });
    if (cats.indexOf(state.filterCat) === -1) state.filterCat = 'All';
    $('#catChips').innerHTML = cats.map(function (c) {
      var on = c === state.filterCat;
      return '<button data-cat="' + esc(c) + '" aria-pressed="' + on + '" class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition ' +
        (on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800') + '">' + esc(c) + '</button>';
    }).join('');
    setSeg('#statusSeg', 'status', state.filterStatus);
    setSeg('#periodSeg', 'period', state.period);
  }

  function cardHTML(h) {
    var t = today(), tk = keyOf(t), sched = isScheduled(h, t), done = isDone(h.id, tk);
    var st = periodStats(h, state.period), streak = streakOf(h), ws = weekStart(t);
    var cells = DAYS.map(function (nm, i) {
      var d = addDays(ws, i), k = keyOf(d), s = isScheduled(h, d), dn = isDone(h.id, k), future = d > t, isT = k === tk;
      var cls, inner = '', style = '', disabled = future || !s;
      if (!s) cls = 'bg-slate-100 dark:bg-slate-800/60 opacity-60';
      else if (dn) { cls = 'text-white'; style = 'background:' + h.color; inner = CHECK; }
      else if (future || isT) cls = 'border border-slate-300 dark:border-slate-600';
      else cls = 'border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30';
      var label = nm + ' ' + k + (!s ? ', not scheduled' : dn ? ', completed' : ', not completed');
      return '<div class="flex flex-col items-center gap-1"><span class="text-[11px] ' + (isT ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400') + '">' + nm + '</span>' +
        '<button ' + (disabled ? 'disabled ' : '') + 'data-action="cell" data-id="' + h.id + '" data-key="' + k + '" aria-label="' + label + '" class="h-8 w-full rounded-lg grid place-items-center transition ' + cls + (disabled ? '' : ' hover:opacity-80') + '" style="' + style + '">' + inner + '</button></div>';
    }).join('');
    var startW = lastPct[h.id] != null ? lastPct[h.id] : 0;
    return '<article class="rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm" style="border-left-color:' + h.color + '">' +
      '<div class="flex items-start gap-3">' +
        '<button data-action="toggle" data-id="' + h.id + '" ' + (sched ? '' : 'disabled ') + 'aria-pressed="' + done + '" aria-label="' + (done ? 'Mark ' : 'Complete ') + esc(h.name) + (done ? ' as not done' : ' for today') + '" ' +
          'class="mt-0.5 h-9 w-9 shrink-0 rounded-full grid place-items-center transition ' + (done ? 'text-white ' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 ') + (sched ? '' : 'opacity-40 cursor-not-allowed ') + (popId === h.id ? 'pop' : '') + '" style="' + (done ? 'background:' + h.color + ';border:0' : '') + '">' + (done ? CHECK.replace('w-4 h-4', 'w-5 h-5') : '') + '</button>' +
        '<div class="min-w-0 flex-1">' +
          '<h3 class="font-semibold leading-snug break-words ' + (done ? 'text-slate-400 dark:text-slate-500 line-through decoration-1' : '') + '">' + esc(h.name) + '</h3>' +
          '<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"><span class="font-medium" style="color:' + h.color + '">' + esc(h.category) + '</span> · ' + scheduleLabel(h) + (sched ? '' : ' · Rest day') + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-1 shrink-0">' +
          '<span class="mr-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ' + (streak ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400') + '" title="Current streak">🔥 ' + streak + '</span>' +
          '<button data-action="edit" data-id="' + h.id + '" aria-label="Edit ' + esc(h.name) + '" class="h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>' +
          '<button data-action="delete" data-id="' + h.id + '" aria-label="Delete ' + esc(h.name) + '" class="h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14M10 11v6M14 11v6"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4">' +
        '<div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5"><span>' + st.done + ' of ' + st.total + ' this ' + state.period + '</span><span class="font-semibold tabular-nums text-slate-700 dark:text-slate-200">' + st.pct + '%</span></div>' +
        '<div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="bar h-full rounded-full" data-w="' + st.pct + '" data-id="' + h.id + '" style="width:' + startW + '%;background:' + h.color + '"></div></div>' +
      '</div>' +
      '<div class="mt-4 grid grid-cols-7 gap-1.5">' + cells + '</div>' +
    '</article>';
  }

  function renderList() {
    var t = today(), tk = keyOf(t);
    var items = state.habits.filter(function (h) {
      if (state.filterCat !== 'All' && h.category !== state.filterCat) return false;
      var done = isDone(h.id, tk), sched = isScheduled(h, t);
      if (state.filterStatus === 'active') return sched && !done;
      if (state.filterStatus === 'completed') return done;
      return true;
    });
    var list = $('#list');
    if (!items.length) {
      var none = !state.habits.length;
      list.innerHTML = '<div class="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">' +
        '<p class="font-semibold">' + (none ? 'No habits yet' : 'No habits match this filter') + '</p>' +
        '<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">' + (none ? 'Add a habit to start building your streak.' : 'Try another category or status.') + '</p>' +
        (none ? '<button data-action="add" class="mt-4 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition">Add habit</button>' : '') + '</div>';
      return;
    }
    list.innerHTML = items.map(cardHTML).join('');
    popId = null;
    list.querySelectorAll('[data-w]').forEach(function (el) {
      void el.offsetWidth;
      el.style.width = el.dataset.w + '%';
      lastPct[el.dataset.id] = Number(el.dataset.w);
    });
  }

  function renderAll() { renderSummary(); renderFilters(); renderList(); }

  /* ---------- Actions ---------- */
  function toggle(id, key) {
    var l = state.log[id] || (state.log[id] = {});
    if (l[key]) delete l[key]; else l[key] = true;
    if (key === keyOf(today())) popId = id;
    save();
    renderAll();
  }

  function syncDayButtons() {
    document.querySelectorAll('#fDays button').forEach(function (b) {
      var on = formDays.indexOf(Number(b.dataset.day)) !== -1;
      b.setAttribute('aria-pressed', on);
      b.className = 'h-10 rounded-lg text-xs font-semibold border transition ' + (on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800');
    });
    var all = formDays.length === 7;
    $('#fDaily').className = 'px-3 py-1 rounded-lg text-xs font-semibold border transition ' + (all ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800');
    $('#fDaily').setAttribute('aria-pressed', all);
  }

  function syncColors() {
    var custom = COLORS.indexOf(formColor) === -1;
    $('#fColors').innerHTML = COLORS.map(function (c) {
      var on = c === formColor;
      return '<button type="button" data-color="' + c + '" role="radio" aria-checked="' + on + '" aria-label="Color ' + c + '" class="h-8 w-8 rounded-full transition ' + (on ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900' : 'hover:scale-110') + '" style="background:' + c + '"></button>';
    }).join('') + '<label class="h-8 px-2 rounded-full border border-slate-300 dark:border-slate-700 text-xs inline-flex items-center gap-1.5 cursor-pointer ' + (custom ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900' : '') + '">Custom<input id="fCustomColor" type="color" value="' + formColor + '" class="h-5 w-5 p-0 border-0 bg-transparent cursor-pointer"></label>';
  }

  function openHabitForm(id) {
    editingId = id || null;
    var h = id ? state.habits.filter(function (x) { return x.id === id; })[0] : null;
    $('#habitTitle').textContent = h ? 'Edit habit' : 'New habit';
    $('#fName').value = h ? h.name : '';
    var cats = DEFAULT_CATS.slice();
    state.habits.forEach(function (x) { if (cats.indexOf(x.category) === -1) cats.push(x.category); });
    $('#fCat').innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    $('#fCat').value = h ? h.category : 'Health';
    formDays = h ? h.days.slice() : ALL_DAYS.slice();
    formColor = h ? h.color : COLORS[0];
    $('#fDays').innerHTML = DAYS.map(function (d, i) { return '<button type="button" data-day="' + i + '">' + d + '</button>'; }).join('');
    $('#fError').classList.add('hidden');
    syncDayButtons(); syncColors();
    openModal($('#habitModal'));
    setTimeout(function () { $('#fName').focus(); }, 30);
  }

  function submitHabit(e) {
    e.preventDefault();
    var name = $('#fName').value.trim(), err = $('#fError');
    if (!name) { err.textContent = 'Enter a name for your habit.'; err.classList.remove('hidden'); $('#fName').focus(); return; }
    if (!formDays.length) { err.textContent = 'Select at least one target day.'; err.classList.remove('hidden'); return; }
    var days = formDays.slice().sort();
    if (editingId) {
      state.habits.forEach(function (h) {
        if (h.id === editingId) { h.name = name; h.category = $('#fCat').value; h.days = days; h.color = formColor; }
      });
      toast('Changes saved');
    } else {
      var id = uid();
      state.habits.push({ id: id, name: name, category: $('#fCat').value, days: days, color: formColor, created: keyOf(today()) });
      state.log[id] = {};
      toast('Habit added');
    }
    save(); closeModal($('#habitModal')); renderAll();
  }

  function deleteHabit(id) {
    state.habits = state.habits.filter(function (h) { return h.id !== id; });
    delete state.log[id]; delete lastPct[id];
    save(); renderAll(); toast('Habit deleted');
  }

  /* ---------- Export / Import ---------- */
  function exportText() {
    var theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    return JSON.stringify({ app: 'habitly', version: 1, exportedAt: new Date().toISOString(), preferences: { theme: theme }, habits: state.habits, log: state.log }, null, 2);
  }

  function importText(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { toast('That is not valid JSON. Check the backup and try again.'); return; }
    var clean = sanitize(parsed);
    if (!clean) { toast('No habits found in that backup.'); return; }
    askConfirm('Replace your data?', 'Importing ' + clean.habits.length + ' habit' + (clean.habits.length === 1 ? '' : 's') + ' will replace your current habits and history.', 'Import', function () {
      state.habits = clean.habits; state.log = clean.log; lastPct = {};
      if (parsed.preferences && (parsed.preferences.theme === 'dark' || parsed.preferences.theme === 'light')) applyTheme(parsed.preferences.theme);
      save(); closeAllModals(); renderAll(); toast('Backup imported');
    });
  }

  function copyText(text, ta) {
    function fallback() {
      ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      toast(ok ? 'Copied to clipboard' : 'Press Ctrl/Cmd+C to copy the selected text');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); }, fallback);
    } else fallback();
  }

  function downloadText(text) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'habitly-backup-' + keyOf(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('Download started. If nothing downloads, use Copy instead.');
    } catch (e) { toast('Download is blocked here. Use Copy instead.'); }
  }

  /* ---------- Theme ---------- */
  function applyTheme(mode) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    storage.set(THEME_KEY, mode);
  }

  /* ---------- Events ---------- */
  function bind() {
    $('#btnAdd').addEventListener('click', function () { openHabitForm(); });
    $('#btnTheme').addEventListener('click', function () { applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'); });
    $('#btnData').addEventListener('click', function () { $('#dataText').value = exportText(); openModal($('#dataModal')); });

    $('#list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-action]');
      if (!b || b.disabled) return;
      var id = b.dataset.id, a = b.dataset.action;
      if (a === 'toggle') toggle(id, keyOf(today()));
      else if (a === 'cell') toggle(id, b.dataset.key);
      else if (a === 'edit') openHabitForm(id);
      else if (a === 'add') openHabitForm();
      else if (a === 'delete') {
        var h = state.habits.filter(function (x) { return x.id === id; })[0];
        if (h) askConfirm('Delete this habit?', '"' + h.name + '" and its history will be removed. This cannot be undone.', 'Delete habit', function () { closeAllModals(); deleteHabit(id); });
      }
    });

    $('#catChips').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) { state.filterCat = b.dataset.cat; renderFilters(); renderList(); } });
    $('#statusSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-status]'); if (b) { state.filterStatus = b.dataset.status; renderFilters(); renderList(); } });
    $('#periodSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-period]'); if (b) { state.period = b.dataset.period; renderFilters(); renderList(); } });

    $('#habitForm').addEventListener('submit', submitHabit);
    $('#fDays').addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]'); if (!b) return;
      var n = Number(b.dataset.day), i = formDays.indexOf(n);
      if (i === -1) formDays.push(n); else formDays.splice(i, 1);
      syncDayButtons();
    });
    $('#fDaily').addEventListener('click', function () { formDays = ALL_DAYS.slice(); syncDayButtons(); });
    $('#fColors').addEventListener('click', function (e) { var b = e.target.closest('[data-color]'); if (b) { formColor = b.dataset.color; syncColors(); } });
    $('#fColors').addEventListener('change', function (e) { if (e.target.id === 'fCustomColor') { formColor = e.target.value; syncColors(); } });

    $('#dCopy').addEventListener('click', function () { copyText($('#dataText').value, $('#dataText')); });
    $('#dDownload').addEventListener('click', function () { downloadText($('#dataText').value); });
    $('#dFile').addEventListener('click', function () { $('#dFileInput').click(); });
    $('#dFileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { $('#dataText').value = String(r.result); importText(String(r.result)); };
      r.onerror = function () { toast('Could not read that file.'); };
      r.readAsText(f);
      e.target.value = '';
    });
    $('#dImport').addEventListener('click', function () { importText($('#dataText').value); });

    $('#cOk').addEventListener('click', function () { var fn = pendingConfirm; pendingConfirm = null; closeModal($('#confirmModal')); if (fn) fn(); });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { var m = b.closest('[role=dialog],[role=alertdialog]'); closeModal(m); if (m.id === 'confirmModal') pendingConfirm = null; });
    });
    ['#habitModal', '#dataModal', '#confirmModal'].forEach(function (s) {
      $(s).addEventListener('mousedown', function (e) { if (e.target === e.currentTarget) { closeModal(e.currentTarget); pendingConfirm = null; } });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllModals(); });

    var currentDay = keyOf(new Date());
    setInterval(function () { var k = keyOf(new Date()); if (k !== currentDay) { currentDay = k; renderAll(); } }, 30000);
  }

  /* ---------- Init ---------- */
  if (!load()) seed();
  bind();
  renderAll();
})();
