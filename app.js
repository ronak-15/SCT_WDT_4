/* ================================================
   DOIT — app.js
   Features: Add / Edit / Delete / Complete
            Filter / Sort / Search / Category
            Progress Ring / Stats / Toast
            LocalStorage persistence
   ================================================ */

// ─── STATE ───────────────────────────────────────
let tasks      = JSON.parse(localStorage.getItem('doit_tasks') || '[]');
let filter     = 'all';
let sort       = 'newest';
let searchQ    = '';
let editId     = null;

// ─── DOM ─────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const taskInput    = $('task-input');
const taskDate     = $('task-date');
const taskTime     = $('task-time');
const taskPriority = $('task-priority');
const taskCat      = $('task-category');
const addBtn       = $('add-btn');
const taskList     = $('task-list');
const emptyState   = $('empty-state');
const searchInput  = $('search-input');
const clearDoneBtn = $('clear-done');
const menuToggle   = $('menu-toggle');
const sidebar      = document.querySelector('.sidebar');

// Stats
const ringFill  = $('ring-fill');
const pctText   = $('pct-text');
const sTotal    = $('s-total');
const sDone     = $('s-done');
const sLeft     = $('s-left');
const countAll  = $('count-all');
const countActive = $('count-active');
const countDone = $('count-done');
const countHigh = $('count-high');
const countMed  = $('count-med');
const countLow  = $('count-low');
const resultCount = $('result-count');
const pageTitle = $('page-title');
const pageSub   = $('page-sub');

// Modal
const modalBg       = $('modal-bg');
const modalClose    = $('modal-close');
const modalCancel   = $('modal-cancel');
const modalSave     = $('modal-save');
const editInput     = $('edit-input');
const editDate      = $('edit-date');
const editTime      = $('edit-time');
const editPriority  = $('edit-priority');
const editCat       = $('edit-category');
const toast         = $('toast');

// Inject SVG gradient for the ring
const svgNS = 'http://www.w3.org/2000/svg';
const defs  = document.createElementNS(svgNS, 'defs');
defs.innerHTML = `
  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#7c3aed"/>
    <stop offset="100%" stop-color="#06b6d4"/>
  </linearGradient>`;
document.querySelector('.ring').prepend(defs);

// ─── HELPERS ─────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function save() { localStorage.setItem('doit_tasks', JSON.stringify(tasks)); }

function fmtDate(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}
function fmtTime(s) {
  if (!s) return null;
  const [h,m] = s.split(':');
  const hr = parseInt(h), ap = hr >= 12 ? 'PM' : 'AM';
  return `${hr%12||12}:${m} ${ap}`;
}
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── TOAST ───────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ─── FILTER / SORT / SEARCH PIPELINE ─────────────
const PRIORITY_ORDER = { high:0, medium:1, low:2 };

function pipeline() {
  let list = [...tasks];

  // Filter
  switch(filter) {
    case 'active':    list = list.filter(t => !t.done); break;
    case 'completed': list = list.filter(t =>  t.done); break;
    case 'high':      list = list.filter(t => t.priority === 'high'); break;
    case 'medium':    list = list.filter(t => t.priority === 'medium'); break;
    case 'low':       list = list.filter(t => t.priority === 'low'); break;
  }

  // Search
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(t =>
      t.text.toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }

  // Sort
  switch(sort) {
    case 'oldest':   list.sort((a,b) => a.ts - b.ts); break;
    case 'priority': list.sort((a,b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]); break;
    case 'alpha':    list.sort((a,b) => a.text.localeCompare(b.text)); break;
    default:         list.sort((a,b) => b.ts - a.ts); // newest
  }

  return list;
}

// ─── STATS / RING ─────────────────────────────────
function updateStats() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const left  = total - done;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  const circ  = 314; // 2πr = 2π×50

  ringFill.style.strokeDashoffset = circ - (circ * pct / 100);
  pctText.textContent = pct + '%';
  sTotal.textContent  = total;
  sDone.textContent   = done;
  sLeft.textContent   = left;

  countAll.textContent    = total;
  countActive.textContent = tasks.filter(t => !t.done).length;
  countDone.textContent   = done;
  countHigh.textContent   = tasks.filter(t => t.priority === 'high').length;
  countMed.textContent    = tasks.filter(t => t.priority === 'medium').length;
  countLow.textContent    = tasks.filter(t => t.priority === 'low').length;
}

// ─── RENDER ──────────────────────────────────────
const PAGE_LABELS = {
  all:'All Tasks', active:'Active', completed:'Completed',
  high:'High Priority', medium:'Medium Priority', low:'Low Priority'
};
const PAGE_SUBS = {
  all:'Everything on your plate',
  active:'Tasks still in progress',
  completed:'Great work! 🎉',
  high:'Urgent items first',
  medium:'Steady progress',
  low:'When you get a chance'
};

function render() {
  updateStats();
  const list = pipeline();

  // Page heading
  pageTitle.textContent = PAGE_LABELS[filter] || 'Tasks';
  pageSub.textContent   = PAGE_SUBS[filter]   || '';

  // Result count
  const word = list.length === 1 ? 'task' : 'tasks';
  resultCount.textContent = `${list.length} ${word}`;

  // Remove old cards
  taskList.querySelectorAll('.task-card').forEach(c => c.remove());

  // Empty state
  emptyState.style.display = list.length === 0 ? 'block' : 'none';

  // Insert cards with stagger
  list.forEach((task, i) => {
    const card = buildCard(task, i);
    taskList.appendChild(card);
  });
}

function buildCard(task, i) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.done ? ' completed' : '');
  card.dataset.id = task.id;
  card.dataset.p  = task.priority;
  card.style.animationDelay = `${i * 40}ms`;

  const dateTag     = fmtDate(task.date)     ? `<span class="tag tag-date"><i class="fa fa-calendar-alt"></i>${fmtDate(task.date)}</span>` : '';
  const timeTag     = fmtTime(task.time)     ? `<span class="tag tag-time"><i class="fa fa-clock"></i>${fmtTime(task.time)}</span>` : '';
  const catTag      = task.category          ? `<span class="tag tag-cat"><i class="fa fa-folder"></i>${esc(task.category)}</span>` : '';
  const prioLabel   = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  const prioTag     = `<span class="tag tag-p-${task.priority}">${prioLabel}</span>`;

  card.innerHTML = `
    <div class="check-ring${task.done ? ' on' : ''}" title="Toggle complete"></div>
    <div class="card-body">
      <div class="task-text">${esc(task.text)}</div>
      <div class="card-tags">${prioTag}${dateTag}${timeTag}${catTag}</div>
    </div>
    <div class="card-actions">
      <button class="act-btn edit-btn" title="Edit"><i class="fa fa-pen"></i></button>
      <button class="act-btn del-btn"  title="Delete"><i class="fa fa-trash"></i></button>
    </div>
  `;

  card.querySelector('.check-ring').addEventListener('click', () => toggleDone(task.id));
  card.querySelector('.edit-btn').addEventListener('click',   () => openEdit(task.id));
  card.querySelector('.del-btn').addEventListener('click',    (e) => deleteTask(task.id, card));

  return card;
}

// ─── CRUD ─────────────────────────────────────────
function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.classList.add('shake');
    taskInput.addEventListener('animationend', () => taskInput.classList.remove('shake'), { once:true });
    return;
  }
  const t = {
    id: uid(), text,
    date:     taskDate.value     || '',
    time:     taskTime.value     || '',
    priority: taskPriority.value || 'medium',
    category: taskCat.value.trim() || '',
    done:     false,
    ts:       Date.now()
  };
  tasks.unshift(t);
  save();
  render();
  taskInput.value = taskDate.value = taskTime.value = taskCat.value = '';
  taskPriority.value = 'medium';
  taskInput.focus();
  showToast('✅ Task added!');
}

function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  save(); render();
  showToast(t.done ? '🎉 Marked complete!' : '🔄 Moved back to active');
}

function deleteTask(id, card) {
  card.style.transition = 'opacity 0.3s, transform 0.3s';
  card.style.opacity = '0';
  card.style.transform = 'translateX(30px) scale(0.95)';
  setTimeout(() => {
    tasks = tasks.filter(t => t.id !== id);
    save(); render();
  }, 300);
  showToast('🗑️ Task deleted');
}

function openEdit(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editId = id;
  editInput.value    = t.text;
  editDate.value     = t.date;
  editTime.value     = t.time;
  editPriority.value = t.priority;
  editCat.value      = t.category || '';
  modalBg.classList.add('open');
  setTimeout(() => editInput.focus(), 200);
}

function closeModal() { modalBg.classList.remove('open'); editId = null; }

function saveEdit() {
  const text = editInput.value.trim();
  if (!text) { editInput.focus(); return; }
  const t = tasks.find(t => t.id === editId);
  if (!t) return;
  t.text     = text;
  t.date     = editDate.value;
  t.time     = editTime.value;
  t.priority = editPriority.value;
  t.category = editCat.value.trim();
  save(); render(); closeModal();
  showToast('✏️ Task updated!');
}

function clearCompleted() {
  const n = tasks.filter(t => t.done).length;
  if (!n) { showToast('Nothing to clear'); return; }
  tasks = tasks.filter(t => !t.done);
  save(); render();
  showToast(`🧹 Cleared ${n} task${n>1?'s':''}`);
}

// ─── EVENTS ───────────────────────────────────────
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
clearDoneBtn.addEventListener('click', clearCompleted);

// Nav filters
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
    // Close sidebar on mobile after clicking
    if (window.innerWidth < 768) sidebar.classList.remove('open');
  });
});

// Sort
$$('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sort = btn.dataset.sort;
    render();
  });
});

// Search
searchInput.addEventListener('input', e => {
  searchQ = e.target.value.trim();
  render();
});

// Modal
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', saveEdit);
modalBg.addEventListener('click', e => { if (e.target === modalBg) closeModal(); });
editInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveEdit();
  if (e.key === 'Escape') closeModal();
});

// Mobile menu toggle
menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

// ─── INIT ─────────────────────────────────────────
render();