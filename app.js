// ============================================================
//  DB
// ============================================================
const db = JSON.parse(localStorage.getItem('financeDB')) || {
  movements: [],
  debts: [],
  incomeFunds: [],
  fortnights: [],      // { id, number, startDate, endDate, amount, closed }
  fixedExpenses: [],   // { id, title, desc, amount, period:'quincenal'|'mensual', payments:[] }
  calendarMode: 'diario' // 'diario' | 'quincenal' | 'mensual'
};

// migrate old debts that don't have debtCategory
db.debts.forEach(d => {
  if (!d.debtCategory) {
    // old 'meDeben' => 'presto', old 'debo' => 'mePrestaron'
    if (d.type === 'meDeben') d.debtCategory = 'presto';
    else d.debtCategory = 'mePrestaron';
  }
});

let currentDate = new Date();
let chart;
let chartType = 'pie';
let selectedDay = null;
let calendarMode = db.calendarMode || 'diario';

// ============================================================
//  UTILS
// ============================================================
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

function parseColombianNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function saveDB() {
  db.calendarMode = calendarMode;
  if (!db.predictions) db.predictions = [];
  localStorage.setItem('financeDB', JSON.stringify(db));
  updateIncomeFunds();
  updateBalance();
  renderCalendarSection();
  renderDebts();
  renderChart();
  populateMonthSelect();
  updateIncomeSelect();
  renderSummaryCards();
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatInputNumber(event) {
  const input = event.target;
  let value = input.value.replace(/\./g, '');
  if (!/^[\d,]*$/.test(value) && value !== '') value = value.replace(/[^\d,]/g, '');
  const parts = value.split(',');
  if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? ',' + parts[1].slice(0, 2) : '';
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  input.value = integerPart + decimalPart;
}

function initAutoFormat() {
  document.querySelectorAll('input[inputmode="decimal"]').forEach(input => {
    input.removeEventListener('input', formatInputNumber);
    input.addEventListener('input', formatInputNumber);
  });
}

// ============================================================
//  INCOME FUNDS
// ============================================================
function updateIncomeFunds() {
  const incomeFundsMap = new Map();
  db.incomeFunds.forEach(f => incomeFundsMap.set(f.id, f));
  db.movements.forEach(m => {
    if (m.type === 'ingreso' && !incomeFundsMap.has(m.id)) {
      incomeFundsMap.set(m.id, { id: m.id, title: m.title, originalAmount: m.amount, remaining: m.amount });
    }
  });
  const incomeIds = new Set(db.movements.filter(m => m.type === 'ingreso').map(m => m.id));
  for (let id of incomeFundsMap.keys()) {
    if (!incomeIds.has(id) && !db.movements.some(m => m.incomeSourceId === id)) {
      incomeFundsMap.delete(id);
    }
  }
  db.incomeFunds = Array.from(incomeFundsMap.values());
}

function updateIncomeSelect() {
  const select = document.getElementById('incomeSourceSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Cargar a:</option>';
  db.incomeFunds.forEach(fund => {
    if (fund.remaining > 0) {
      const option = document.createElement('option');
      option.value = fund.id;
      option.textContent = `${fund.title} ($${formatNumber(fund.remaining)} disponibles)`;
      select.appendChild(option);
    }
  });
}

function toggleIncomeSelect() {
  const type = document.getElementById('movType').value;
  const incomeSelect = document.getElementById('incomeSourceSelect');
  if (incomeSelect) {
    incomeSelect.style.display = type === 'egreso' ? 'block' : 'none';
    if (type === 'egreso') updateIncomeSelect();
  }
}

// ============================================================
//  BALANCE
// ============================================================
function updateBalance() {
  let total = 0;
  db.movements.forEach(m => {
    if (m.type === 'ingreso') total += m.amount;
    else total -= m.amount;
  });
  const el = document.getElementById('balance');
  if (el) el.innerHTML = `$${formatNumber(total)}`;
}

// ============================================================
//  SUMMARY CARDS
// ============================================================
function renderSummaryCards() {
  const container = document.getElementById('summaryCards');
  if (!container) return;
  let totalIngresos = 0, totalEgresos = 0, totalMeDeben = 0, totalDebo = 0;
  db.movements.forEach(m => {
    if (m.type === 'ingreso') totalIngresos += m.amount;
    else totalEgresos += m.amount;
  });
  db.debts.forEach(d => {
    const cat = d.debtCategory || d.type;
    if (cat === 'meDeben' || cat === 'presto') totalMeDeben += (d.remaining || 0);
    else totalDebo += (d.remaining || 0);
  });
  container.innerHTML = `
    <h2 style="color:#f1f5f9;font-size:1.2rem;font-weight:700;margin-bottom:0.8rem;">Resumen detallado</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      <div style="background:#16a34a;border-radius:12px;padding:1rem;">
        <div style="color:#dcfce7;font-size:0.85rem;">Ingresos</div>
        <div style="color:#fff;font-size:1.3rem;font-weight:700;">+$${formatNumber(totalIngresos)}</div>
      </div>
      <div style="background:#dc2626;border-radius:12px;padding:1rem;">
        <div style="color:#fee2e2;font-size:0.85rem;">Egresos</div>
        <div style="color:#fff;font-size:1.3rem;font-weight:700;">-$${formatNumber(totalEgresos)}</div>
      </div>
      <div style="background:#2563eb;border-radius:12px;padding:1rem;">
        <div style="color:#dbeafe;font-size:0.85rem;">Me deben / Presté</div>
        <div style="color:#fff;font-size:1.3rem;font-weight:700;">$${formatNumber(totalMeDeben)}</div>
      </div>
      <div style="background:#c2410c;border-radius:12px;padding:1rem;">
        <div style="color:#ffedd5;font-size:0.85rem;">Debo / Me prestaron</div>
        <div style="color:#fbbf24;font-size:1.3rem;font-weight:700;">$${formatNumber(totalDebo)}</div>
      </div>
    </div>`;
}

// ============================================================
//  MOVEMENTS
// ============================================================
function addMovement() {
  const movDate = document.getElementById('movDate');
  const movType = document.getElementById('movType');
  const movTitle = document.getElementById('movTitle');
  const movDesc = document.getElementById('movDesc');
  const movAmount = document.getElementById('movAmount');
  const incomeSourceSelect = document.getElementById('incomeSourceSelect');

  if (!movDate.value || !movTitle.value || !movAmount.value) {
    alert('Por favor completa los campos requeridos');
    return;
  }

  const amount = parseColombianNumber(movAmount.value);
  const movement = {
    id: Date.now(),
    date: movDate.value,
    type: movType.value,
    title: movTitle.value,
    desc: movDesc.value,
    amount: amount
  };

  if (movType.value === 'egreso') {
    let remainingAmount = amount;
    let fundsUsed = [];
    let primaryFund = null;
    let availableFunds = db.incomeFunds.filter(f => f.remaining > 0);

    if (incomeSourceSelect && incomeSourceSelect.value) {
      const selectedId = parseInt(incomeSourceSelect.value);
      const selectedFund = db.incomeFunds.find(f => f.id === selectedId);
      if (selectedFund && selectedFund.remaining > 0) {
        availableFunds = [selectedFund, ...availableFunds.filter(f => f.id !== selectedId)];
      }
    } else {
      availableFunds.sort((a, b) => b.remaining - a.remaining);
    }

    for (let fund of availableFunds) {
      if (remainingAmount <= 0) break;
      const takeFromThis = Math.min(fund.remaining, remainingAmount);
      fund.remaining -= takeFromThis;
      remainingAmount -= takeFromThis;
      fundsUsed.push({ id: fund.id, amount: takeFromThis });
      if (!primaryFund) primaryFund = fund;
    }

    if (remainingAmount > 0) {
      if (confirm(`No hay suficiente saldo para cubrir $${formatNumber(remainingAmount)} restante.\n¿Registrar como sobregiro?`)) {
        movement.incomeSourceId = primaryFund ? primaryFund.id : null;
        movement.overspend = remainingAmount;
      } else return;
    } else {
      if (primaryFund) {
        movement.incomeSourceId = primaryFund.id;
        movement.fundsUsed = fundsUsed;
      }
    }

    // También descontar de quincena/mes activo si aplica
    if (calendarMode !== 'diario') {
      const activePeriod = getActivePeriod();
      if (activePeriod) {
        activePeriod.spent = (activePeriod.spent || 0) + amount;
        activePeriod.remaining = activePeriod.amount - activePeriod.spent;
      }
    }
  }

  db.movements.push(movement);

  if (movType.value === 'ingreso') {
    db.incomeFunds.push({
      id: movement.id,
      title: movement.title,
      originalAmount: movement.amount,
      remaining: movement.amount
    });
  }

  saveDB();

  movTitle.value = '';
  movDesc.value = '';
  movAmount.value = '';
  if (incomeSourceSelect) incomeSourceSelect.value = '';

  if (calendarMode === 'diario') showDayMovements(movDate.value);
  else renderPeriodSummary();
}

function showDayMovements(date) {
  const dayMovements = document.getElementById('dayMovements');
  const movementsTitle = document.getElementById('movementsTitle');
  if (!dayMovements) return;
  const dayMovs = db.movements.filter(m => m.date === date);
  if (movementsTitle) movementsTitle.innerText = `Movimientos del ${formatDate(date)}`;
  if (dayMovs.length === 0) {
    dayMovements.innerHTML = '<p style="color:#94a3b8;">No hay movimientos para este día</p>';
    return;
  }
  let html = '';
  dayMovs.forEach(mov => {
    let sourceText = '';
    if (mov.incomeSourceId) {
      const fund = db.incomeFunds.find(f => f.id === mov.incomeSourceId);
      if (fund) sourceText = `<br><small style="color:#94a3b8;">Sale de: ${fund.title}</small>`;
    }
    html += `
      <div class="movement-item">
        <div>
          <strong>${mov.title}</strong>
          <div>${mov.type === 'ingreso' ? '➕' : '➖'} $${formatNumber(mov.amount)}</div>
          ${mov.desc ? `<small>${mov.desc}</small>` : ''}
          ${sourceText}
        </div>
        <div class="movement-actions">
          <button class="secondary" onclick="editMovement(${mov.id})">✏️</button>
          <button class="danger" onclick="deleteMovement(${mov.id})">🗑️</button>
        </div>
      </div>`;
  });
  html += `<button class="secondary" style="width:100%;margin-top:0.5rem;" onclick="openModal('${date}')">Ver/Editar todos</button>`;
  dayMovements.innerHTML = html;
}

function editMovement(id) {
  const mov = db.movements.find(m => m.id === id);
  if (!mov) return;
  document.getElementById('movDate').value = mov.date;
  document.getElementById('movType').value = mov.type;
  document.getElementById('movTitle').value = mov.title;
  document.getElementById('movDesc').value = mov.desc;
  document.getElementById('movAmount').value = formatNumber(mov.amount);
  deleteMovement(id, false);
  showView('calendar', document.querySelector('nav button:nth-child(2)'));
  if (calendarMode === 'diario') selectDay(mov.date);
}

function deleteMovement(id, confirmDelete = true) {
  if (confirmDelete && !window.confirm('¿Estás seguro de eliminar este movimiento?')) return;
  const index = db.movements.findIndex(m => m.id === id);
  if (index !== -1) {
    const mov = db.movements[index];
    if (mov.incomeSourceId) {
      const fund = db.incomeFunds.find(f => f.id === mov.incomeSourceId);
      if (fund) fund.remaining += mov.amount;
    }
    if (mov.type === 'ingreso') {
      const fi = db.incomeFunds.findIndex(f => f.id === mov.id);
      if (fi !== -1) db.incomeFunds.splice(fi, 1);
    }
    db.movements.splice(index, 1);
    saveDB();
    if (selectedDay) showDayMovements(selectedDay);
  }
}

// ============================================================
//  CALENDAR MODE SWITCH
// ============================================================
function renderCalendarSection() {
  if (calendarMode === 'diario') {
    renderCalendar();
    document.getElementById('dailyCalendarWrap').style.display = 'block';
    document.getElementById('periodCalendarWrap').style.display = 'none';
  } else {
    document.getElementById('dailyCalendarWrap').style.display = 'none';
    document.getElementById('periodCalendarWrap').style.display = 'block';
    renderPeriodView();
  }
  renderFixedExpensesList();
}

function onCalendarModeChange() {
  calendarMode = document.getElementById('calendarModeSelect').value;
  db.calendarMode = calendarMode;
  renderCalendarSection();
}

// ============================================================
//  DAILY CALENDAR
// ============================================================
function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  document.getElementById('monthLabel').innerText = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const calendarGrid = document.getElementById('calendarGrid');
  calendarGrid.innerHTML = '';
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < firstDay; i++) calendarGrid.innerHTML += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasMov = db.movements.some(mv => mv.date === date);
    const isToday = date === todayStr;
    let dayClass = 'day';
    if (hasMov) dayClass += ' has';
    if (isToday) dayClass += ' today';
    if (selectedDay === date) dayClass += ' selected';
    calendarGrid.innerHTML += `<div class="${dayClass}" onclick="selectDay('${date}')">${d}</div>`;
  }
  if (selectedDay) showDayMovements(selectedDay);
}

function selectDay(date) {
  selectedDay = date;
  document.getElementById('movDate').value = date;
  showDayMovements(date);
  renderCalendar();
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  selectedDay = null;
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  selectedDay = null;
  renderCalendar();
}

// ============================================================
//  FORTNIGHT / MONTH PERIOD LOGIC
//
//  Quincena logic:
//   - Pay days are the 15th and the last day of each month.
//   - Quincena 1 of a month: starts on the 16th (day after last day of prev month),
//     ends on the 15th of current month.
//     Wait — simpler model per user: payment on 15 and last day of month.
//     So:
//       Quincena A (first half): starts day 1, ends day 15, paid on day 15.
//       Quincena B (second half): starts day 16, ends last day of month, paid on last day.
//     We number them globally: Jan A = 1, Jan B = 2, Feb A = 3, Feb B = 4, etc.
// ============================================================

function getLastDayOfMonth(year, month) {
  // month is 0-based
  return new Date(year, month + 1, 0).getDate();
}

function getPeriodDates(number, mode) {
  if (mode === 'quincenal') {
    // number is 1-based global index: 1=Jan-A, 2=Jan-B, 3=Feb-A, 4=Feb-B, ...
    const year = new Date().getFullYear() + Math.floor((number - 1) / 24);
    const monthIndex = Math.floor(((number - 1) % 24) / 2); // 0=Jan,1=Feb,...
    const isSecondHalf = (number % 2 === 0);
    let startDate, endDate;
    if (!isSecondHalf) {
      // First half: 1–15
      startDate = new Date(year, monthIndex, 1);
      endDate   = new Date(year, monthIndex, 15);
    } else {
      // Second half: 16–last day
      const lastDay = getLastDayOfMonth(year, monthIndex);
      startDate = new Date(year, monthIndex, 16);
      endDate   = new Date(year, monthIndex, lastDay);
    }
    return { startDate, endDate };
  } else {
    // Monthly: number 1=Jan, 2=Feb, ...
    const year = new Date().getFullYear() + Math.floor((number - 1) / 12);
    const monthIndex = (number - 1) % 12;
    const startDate = new Date(year, monthIndex, 1);
    const endDate   = new Date(year, monthIndex + 1, 0);
    return { startDate, endDate };
  }
}

function getCurrentPeriodNumber(mode) {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-based
  const day   = today.getDate();

  if (mode === 'quincenal') {
    // Global number: each year has 24 fortnights (2 per month)
    const yearOffset = (year - new Date().getFullYear()) * 24;
    const monthFortnights = month * 2; // months before this one
    const halfOffset = day <= 15 ? 0 : 1; // 0=first half, 1=second half
    return yearOffset + monthFortnights + halfOffset + 1;
  } else {
    return month + 1; // 1-12
  }
}

function getActivePeriod() {
  if (!db.fortnights) db.fortnights = [];
  const mode = calendarMode;
  const currentNum = getCurrentPeriodNumber(mode);
  return db.fortnights.find(f => f.number === currentNum && f.mode === mode && !f.closed);
}

function formatPeriodLabel(period) {
  const s = new Date(period.startDate);
  const e = new Date(period.endDate);
  const opts = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('es-CO', opts)} – ${e.toLocaleDateString('es-CO', opts)}`;
}

function renderPeriodView() {
  const wrap = document.getElementById('periodCalendarWrap');
  if (!wrap) return;
  if (!db.fortnights) db.fortnights = [];

  const mode = calendarMode;
  const currentNum = getCurrentPeriodNumber(mode);
  const activePeriod = getActivePeriod();
  const modeLabel = mode === 'quincenal' ? 'Quincena' : 'Mes';

  // Compute spent from movements in period date range
  if (activePeriod) {
    const s = new Date(activePeriod.startDate);
    const e = new Date(activePeriod.endDate);
    let spent = 0;
    db.movements.forEach(m => {
      if (m.type === 'egreso') {
        const d = new Date(m.date);
        if (d >= s && d <= e) spent += m.amount;
      }
    });
    activePeriod.spent = spent;
    activePeriod.remaining = activePeriod.amount - spent;
  }

  // Auto-select end date of active period in the movement form
  // so egresos are recorded on the last day of the period
  if (activePeriod) {
    const movDateEl = document.getElementById('movDate');
    if (movDateEl) movDateEl.value = activePeriod.endDate;
    selectedDay = activePeriod.endDate;
  }

  let html = '';

  if (!activePeriod) {
    const { startDate, endDate } = getPeriodDates(currentNum, mode);
    const s = startDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    const e = endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    html = `
      <div class="card" style="text-align:center;">
        <h3 style="color:#94a3b8;margin-bottom:0.3rem;">${modeLabel} ${currentNum}</h3>
        <p style="color:#64748b;font-size:0.9rem;margin-bottom:1.5rem;">${s} – ${e}</p>
        <p style="color:#94a3b8;margin-bottom:1rem;">No has iniciado esta ${modeLabel.toLowerCase()} aun.</p>
        <button class="primary" onclick="showStartPeriodDialog(${currentNum})" style="font-size:1.1rem;padding:0.8rem;">
          Iniciar ${modeLabel} ${currentNum}
        </button>
      </div>`;
  } else {
    const remaining = activePeriod.remaining || 0;
    const spent = activePeriod.spent || 0;
    const total = activePeriod.amount || 0;
    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
    const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';

    html = `
      <div class="card" style="text-align:center;padding:1.5rem;">
        <div style="font-size:0.85rem;color:#64748b;margin-bottom:0.3rem;">${modeLabel} ${activePeriod.number} · ${formatPeriodLabel(activePeriod)}</div>
        <div style="font-size:3rem;font-weight:800;color:${color};line-height:1.1;">$${formatNumber(remaining)}</div>
        <div style="font-size:0.9rem;color:#94a3b8;margin-top:0.3rem;">disponible de $${formatNumber(total)}</div>
        <div style="margin:1rem 0;background:#1e293b;border-radius:999px;height:12px;overflow:hidden;">
          <div style="width:${pct}%;background:${color};height:100%;border-radius:999px;transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#64748b;">
          <span>Gastado: $${formatNumber(spent)}</span>
          <span>${pct.toFixed(1)}% restante</span>
        </div>
      </div>`;
  }

  // Past periods
  const pastPeriods = (db.fortnights || []).filter(f => f.mode === mode && f.number < currentNum).sort((a, b) => b.number - a.number).slice(0, 5);
  if (pastPeriods.length > 0) {
    html += `<div class="card"><h3 style="margin-bottom:0.8rem;">${modeLabel}s anteriores</h3>`;
    pastPeriods.forEach(p => {
      const pSpent = p.spent || 0;
      const pTotal = p.amount || 0;
      const pPct = pTotal > 0 ? ((pTotal - pSpent) / pTotal * 100).toFixed(1) : 0;
      html += `
        <div style="background:#1e293b;border-radius:8px;padding:0.8rem;margin-bottom:0.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>${modeLabel} ${p.number}</strong>
              <div style="font-size:0.8rem;color:#64748b;">${formatPeriodLabel(p)}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:#22c55e;font-weight:700;">$${formatNumber(pTotal - pSpent)}</div>
              <div style="font-size:0.8rem;color:#64748b;">${pPct}% sobrante</div>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  wrap.innerHTML = html;

  // After rendering, update the form to show day movements for period end date
  if (activePeriod) showDayMovements(activePeriod.endDate);
}

function showStartPeriodDialog(num) {
  const mode = calendarMode;
  const modeLabel = mode === 'quincenal' ? 'quincena' : 'mes';
  const { startDate, endDate } = getPeriodDates(num, mode);

  const modal = document.getElementById('startPeriodModal');
  document.getElementById('startPeriodTitle').textContent = `Iniciar ${modeLabel} ${num}`;
  document.getElementById('startPeriodDateRange').textContent = `${startDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} – ${endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
  document.getElementById('startPeriodAmount').value = '';
  document.getElementById('startPeriodNum').value = num;
  modal.style.display = 'flex';
  setTimeout(initAutoFormat, 50);
}

function confirmStartPeriod() {
  const num = parseInt(document.getElementById('startPeriodNum').value);
  const amount = parseColombianNumber(document.getElementById('startPeriodAmount').value);
  if (!amount || amount <= 0) { alert('Ingresa un monto válido'); return; }

  const mode = calendarMode;
  const modeLabel = mode === 'quincenal' ? 'Quincena' : 'Mes';
  const { startDate, endDate } = getPeriodDates(num, mode);

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const labelShort = mode === 'quincenal'
    ? `${startDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}–${endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
    : startDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const period = {
    id: Date.now(),
    number: num,
    mode: mode,
    startDate: startStr,
    endDate: endStr,
    amount: amount,
    spent: 0,
    remaining: amount,
    closed: false
  };

  if (!db.fortnights) db.fortnights = [];
  db.fortnights.push(period);

  // Register as income movement
  const movTitle = `${modeLabel} ${num} (${labelShort})`;
  const mov = {
    id: Date.now() + 1,
    date: startStr,
    type: 'ingreso',
    title: movTitle,
    desc: `Ingreso de ${modeLabel.toLowerCase()} ${num}`,
    amount: amount
  };
  db.movements.push(mov);
  db.incomeFunds.push({ id: mov.id, title: movTitle, originalAmount: amount, remaining: amount });

  closeStartPeriodModal();
  saveDB();
}

function closeStartPeriodModal() {
  document.getElementById('startPeriodModal').style.display = 'none';
}

// ============================================================
//  FIXED EXPENSES
// ============================================================
function showAddFixedExpense() {
  document.getElementById('fixedExpenseModal').style.display = 'flex';
  setTimeout(initAutoFormat, 50);
}

function closeFixedExpenseModal() {
  document.getElementById('fixedExpenseModal').style.display = 'none';
  // clear
  ['fixedExpTitle','fixedExpDesc','fixedExpAmount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function saveFixedExpense() {
  const title = document.getElementById('fixedExpTitle').value.trim();
  const desc = document.getElementById('fixedExpDesc').value.trim();
  const amount = parseColombianNumber(document.getElementById('fixedExpAmount').value);
  const period = document.getElementById('fixedExpPeriod').value;

  if (!title || !amount) { alert('Título y monto son requeridos'); return; }

  if (!db.fixedExpenses) db.fixedExpenses = [];
  db.fixedExpenses.push({ id: Date.now(), title, desc, amount, period, payments: [] });

  closeFixedExpenseModal();
  saveDB();
}

function renderFixedExpensesList() {
  const container = document.getElementById('fixedExpensesList');
  if (!container) return;
  if (!db.fixedExpenses) db.fixedExpenses = [];
  if (db.fixedExpenses.length === 0) {
    container.innerHTML = '<p style="color:#64748b;font-size:0.9rem;">Sin gastos fijos registrados.</p>';
    return;
  }

  // Each fixed expense uses its OWN period key based on its own frequency,
  // not the calendar mode. This prevents resets when switching modes.
  // A 'mensual' expense paid this month stays paid regardless of which view is open.
  // A 'quincenal' expense paid this fortnight stays paid regardless of view.
  function keyForExpense(fe) {
    return getCurrentPeriodKey(fe.period);
  }

  const pendingExpenses = db.fixedExpenses.filter(fe => {
    const key = keyForExpense(fe);
    return !fe.payments || !fe.payments.includes(key);
  });

  let html = '';
  if (pendingExpenses.length > 1) {
    const totalPending = pendingExpenses.reduce((s, fe) => s + fe.amount, 0);
    html += `<button class="secondary" onclick="payAllFixed()" style="width:100%;margin-bottom:0.8rem;">Pagar todo ($${formatNumber(totalPending)})</button>`;
  }

  db.fixedExpenses.forEach((fe, idx) => {
    const key = keyForExpense(fe);
    const paid = fe.payments && fe.payments.includes(key);
    html += `
      <div style="background:#1e293b;border-radius:10px;padding:0.8rem;margin-bottom:0.6rem;display:flex;align-items:center;gap:0.8rem;">
        <div style="flex:1;">
          <div style="font-weight:600;color:${paid ? '#64748b' : '#f1f5f9'};">${fe.title} ${paid ? '[pagado]' : '[pendiente]'}</div>
          ${fe.desc ? `<div style="font-size:0.8rem;color:#64748b;">${fe.desc}</div>` : ''}
          <div style="font-size:0.85rem;color:#94a3b8;">$${formatNumber(fe.amount)} · ${fe.period}</div>
          ${paid ? `<div style="font-size:0.75rem;color:#22c55e;">Pagado este periodo</div>` : ''}
        </div>
        ${!paid ? `<button class="primary" onclick="payFixedExpense(${idx})" style="width:auto;padding:0.4rem 0.8rem;font-size:0.85rem;white-space:nowrap;">Pagar</button>` : ''}
        <button class="danger" onclick="deleteFixedExpense(${idx})" style="padding:0.4rem 0.6rem;">X</button>
      </div>`;
  });

  container.innerHTML = html;
}

function getCurrentPeriodKey(mode) {
  // Key is based on actual calendar dates so it stays stable across mode switches.
  // A monthly gasto fijo paid in "2025-04" should not reappear just because we
  // switched to quincenal view and back.
  if (!mode || mode === 'diario') {
    // Daily mode: key is per-day (existing behaviour)
    return 'diario-' + new Date().toISOString().slice(0, 10);
  }
  if (mode === 'quincenal') {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const half = today.getDate() <= 15 ? 'A' : 'B';
    return `quincenal-${y}-${m}-${half}`;
  }
  // mensual
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return `mensual-${y}-${m}`;
}

function isFirstFortnightOfMonth() {
  return new Date().getDate() <= 15;
}

function payFixedExpense(idx) {
  const fe = db.fixedExpenses[idx];
  if (!fe) return;
  // Use the expense's own frequency to determine its period key
  const periodKey = getCurrentPeriodKey(fe.period);

  if (!fe.payments) fe.payments = [];
  if (fe.payments.includes(periodKey)) { alert('Ya pagado en este periodo'); return; }

  // Find the active period's income fund to charge to
  // In quincenal/mensual mode, we prefer to charge to the current period's fund
  const activePeriod = getActivePeriod();
  let targetFundId = null;
  if (activePeriod) {
    // Find the income movement that corresponds to this period (starts on period startDate)
    const periodFund = db.incomeFunds.find(f => {
      const mov = db.movements.find(m => m.id === f.id && m.type === 'ingreso' && m.date === activePeriod.startDate);
      return !!mov;
    });
    if (periodFund && periodFund.remaining > 0) targetFundId = periodFund.id;
  }

  // Register as egreso on the last day of the current period (end of period)
  const targetDate = activePeriod ? activePeriod.endDate : new Date().toISOString().slice(0, 10);
  const movement = {
    id: Date.now(),
    date: targetDate,
    type: 'egreso',
    title: `[Gasto Fijo] ${fe.title}`,
    desc: fe.desc,
    amount: fe.amount
  };

  // Deduct from funds: prioritize the active period fund, then fall back to others
  let remaining = fe.amount;
  let usedFunds = [];

  if (targetFundId) {
    const pf = db.incomeFunds.find(f => f.id === targetFundId);
    if (pf) {
      const take = Math.min(pf.remaining, remaining);
      pf.remaining -= take;
      remaining -= take;
      usedFunds.push({ id: pf.id, amount: take });
      movement.incomeSourceId = pf.id;
    }
  }

  if (remaining > 0) {
    const otherFunds = db.incomeFunds.filter(f => f.remaining > 0 && f.id !== targetFundId).sort((a, b) => b.remaining - a.remaining);
    for (let fund of otherFunds) {
      if (remaining <= 0) break;
      const take = Math.min(fund.remaining, remaining);
      fund.remaining -= take;
      remaining -= take;
      usedFunds.push({ id: fund.id, amount: take });
      if (!movement.incomeSourceId) movement.incomeSourceId = fund.id;
    }
  }

  movement.fundsUsed = usedFunds;
  db.movements.push(movement);
  fe.payments.push(periodKey);
  saveDB();
}

function payAllFixed() {
  // Filter pending using each expense's own period key
  const pending = db.fixedExpenses.filter(fe => {
    const key = getCurrentPeriodKey(fe.period);
    return !fe.payments || !fe.payments.includes(key);
  });
  if (pending.length === 0) return;
  const total = pending.reduce((s, fe) => s + fe.amount, 0);
  if (!confirm(`Pagar ${pending.length} gastos fijos por $${formatNumber(total)}?`)) return;
  pending.forEach(fe => {
    const idx = db.fixedExpenses.indexOf(fe);
    payFixedExpense(idx);
  });
}

function deleteFixedExpense(idx) {
  if (!confirm('¿Eliminar este gasto fijo?')) return;
  db.fixedExpenses.splice(idx, 1);
  saveDB();
}

// ============================================================
//  CHART
// ============================================================
function renderChart() {
  const monthSelect = document.getElementById('chartMonthSelect');
  if (!monthSelect) return;
  const selectedMonth = monthSelect.value;
  let filteredMovements = db.movements.filter(m => m.type === 'egreso');
  if (selectedMonth) filteredMovements = filteredMovements.filter(m => m.date.slice(0, 7) === selectedMonth);
  const data = {};
  filteredMovements.forEach(m => data[m.title] = (data[m.title] || 0) + m.amount);
  if (chart) chart.destroy();
  const canvas = document.getElementById('expensesChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  chart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: ['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#10b981']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#e5e7eb' } },
        tooltip: { callbacks: { label: (ctx) => '$' + formatNumber(ctx.raw) } }
      }
    }
  });
}

function toggleChartType() {
  chartType = chartType === 'pie' ? 'bar' : 'pie';
  renderChart();
}

function populateMonthSelect() {
  const monthSelect = document.getElementById('chartMonthSelect');
  if (!monthSelect) return;
  const months = new Set();
  db.movements.forEach(m => { if (m.type === 'egreso') months.add(m.date.slice(0, 7)); });
  while (monthSelect.options.length > 1) monthSelect.remove(1);
  Array.from(months).sort().reverse().forEach(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(year, monthNum - 1, 1);
    const option = document.createElement('option');
    option.value = month;
    option.text = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    monthSelect.appendChild(option);
  });
}

// ============================================================
//  MODALS
// ============================================================
function openModal(date) {
  const modal = document.getElementById('movementModal');
  const modalList = document.getElementById('modalMovementsList');
  const modalTitle = document.getElementById('modalTitle');
  const dayMovs = db.movements.filter(m => m.date === date);
  modalTitle.innerText = `Movimientos del ${formatDate(date)}`;
  if (dayMovs.length === 0) modalList.innerHTML = '<p>No hay movimientos para este día</p>';
  else {
    modalList.innerHTML = '';
    dayMovs.forEach(mov => {
      const [year, month, day] = mov.date.split('-');
      let sourceText = '';
      if (mov.incomeSourceId) {
        const fund = db.incomeFunds.find(f => f.id === mov.incomeSourceId);
        if (fund) sourceText = `<br><small>Sale de: ${fund.title}</small>`;
      }
      modalList.innerHTML += `
        <div class="modal-movement-item">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <strong>${mov.title}</strong>
              <div>${mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}: $${formatNumber(mov.amount)}</div>
              <div><small>${day}/${month}/${year}</small></div>
              ${mov.desc ? `<small>${mov.desc}</small>` : ''}${sourceText}
            </div>
            <div style="display:flex;gap:0.5rem;">
              <button class="secondary" onclick="editMovement(${mov.id});closeModal()">Editar</button>
              <button class="danger" onclick="deleteMovement(${mov.id});closeModal()">Eliminar</button>
            </div>
          </div>
        </div>`;
    });
  }
  modal.style.display = 'flex';
}

function closeModal() { document.getElementById('movementModal').style.display = 'none'; }

function showIncomeDetails() {
  const modal = document.getElementById('incomeDetailModal');
  const detailList = document.getElementById('incomeDetailList');
  if (db.incomeFunds.length === 0) {
    detailList.innerHTML = '<p>No hay ingresos registrados</p>';
  } else {
    detailList.innerHTML = '';
    const activeFunds = db.incomeFunds.filter(f => f.remaining > 0);
    const emptyFunds = db.incomeFunds.filter(f => f.remaining <= 0);
    activeFunds.forEach(fund => {
      const pct = ((fund.remaining / fund.originalAmount) * 100).toFixed(1);
      detailList.innerHTML += `
        <div class="income-detail-item" style="border-left:4px solid #22c55e;margin-bottom:0.5rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.3rem;">
            <strong>${fund.title}</strong>
            <span style="color:#22c55e;">$${formatNumber(fund.remaining)} / $${formatNumber(fund.originalAmount)}</span>
          </div>
          <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:0.3rem;">
            <small style="color:#22c55e;">${pct}% disponible</small>
            <small>$${formatNumber(fund.originalAmount - fund.remaining)} gastado</small>
          </div>
        </div>`;
    });
    if (emptyFunds.length > 0) {
      if (activeFunds.length > 0) detailList.innerHTML += '<hr style="border-color:#334155;margin:1rem 0;"><p style="color:#94a3b8;"><small>📁 Ingresos agotados:</small></p>';
      emptyFunds.forEach(fund => {
        detailList.innerHTML += `
          <div class="income-detail-item" style="opacity:0.6;border-left:4px solid #64748b;margin-bottom:0.3rem;">
            <div style="display:flex;justify-content:space-between;">
              <strong>${fund.title}</strong>
              <span style="color:#94a3b8;">$0 / $${formatNumber(fund.originalAmount)}</span>
            </div>
            <small style="color:#94a3b8;">Completamente gastado</small>
          </div>`;
      });
    }
  }
  modal.style.display = 'flex';
}

function closeIncomeModal() { document.getElementById('incomeDetailModal').style.display = 'none'; }

// ============================================================
//  DEBTS — 4 CATEGORIES
//  presto:      Yo presté → sale dinero. Abonos = entra dinero.
//  mePrestaron: Me prestaron → entra dinero. Abonos = sale dinero.
//  meDeben:     Me deben (no salió de mi bolsillo). Abonos = entra dinero.
//  debo:        Debo (no entró a mi bolsillo). Abonos = sale dinero.
// ============================================================
function addDebt() {
  const cat = document.getElementById('debtType').value; // presto|mePrestaron|meDeben|debo
  const amount = parseColombianNumber(document.getElementById('debtAmount').value);
  const person = document.getElementById('debtPerson').value.trim();
  const title = document.getElementById('debtTitle').value.trim();
  const desc = document.getElementById('debtDesc').value.trim();
  const date = document.getElementById('debtDate').value;

  if (!person || !title || !amount || !date) { alert('Completa todos los campos'); return; }

  // Interest fields (only for presto/mePrestaron)
  const hasInterest = document.getElementById('debtHasInterest').checked;
  let interestRate = 0, interestPeriod = 'mensual', interestType = 'simple', termMonths = 0;
  if (hasInterest && (cat === 'presto' || cat === 'mePrestaron')) {
    interestRate = parseFloat(document.getElementById('debtInterestRate').value) || 0;
    interestPeriod = document.getElementById('debtInterestPeriod').value;
    interestType = document.getElementById('debtInterestType').value;
    termMonths = parseInt(document.getElementById('debtTermMonths').value) || 0;
  }

  // Calculate total with interest
  let totalWithInterest = amount;
  if (hasInterest && interestRate > 0 && termMonths > 0) {
    const r = interestRate / 100;
    const n = interestPeriod === 'mensual' ? termMonths : termMonths * 2;
    if (interestType === 'simple') {
      totalWithInterest = amount * (1 + r * (termMonths / (interestPeriod === 'mensual' ? 1 : 0.5)));
    } else {
      // Compound
      totalWithInterest = amount * Math.pow(1 + r, termMonths / (interestPeriod === 'mensual' ? 1 : 0.5));
    }
  }

  const d = {
    id: Date.now(),
    debtCategory: cat,
    type: cat, // keep for compatibility
    person, title, desc,
    amount: totalWithInterest,
    principal: amount,
    date, remaining: totalWithInterest,
    hasInterest, interestRate, interestPeriod, interestType, termMonths
  };

  db.debts.push(d);

  // Only create movement for presto/mePrestaron (money actually moves)
  if (cat === 'presto') {
    db.movements.push({ id: Date.now() + 1, date, type: 'egreso', title: `Préstamo: ${title}`, desc, amount });
  } else if (cat === 'mePrestaron') {
    db.movements.push({ id: Date.now() + 1, date, type: 'ingreso', title: `Prestado: ${title}`, desc, amount });
  }
  // meDeben / debo: no movement yet, money moves when paid/pay

  saveDB();
  ['debtPerson','debtTitle','debtDesc','debtAmount'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('debtDate').value = '';
  document.getElementById('debtHasInterest').checked = false;
  toggleInterestFields();
}

function toggleInterestFields() {
  const hasInterest = document.getElementById('debtHasInterest').checked;
  const cat = document.getElementById('debtType').value;
  const show = hasInterest && (cat === 'presto' || cat === 'mePrestaron');
  document.getElementById('interestFields').style.display = show ? 'block' : 'none';
  if (show) updateInterestPreview();
}

function updateInterestPreview() {
  const amount = parseColombianNumber(document.getElementById('debtAmount').value);
  const rate = parseFloat(document.getElementById('debtInterestRate').value) || 0;
  const type = document.getElementById('debtInterestType').value;
  const period = document.getElementById('debtInterestPeriod').value;
  const months = parseInt(document.getElementById('debtTermMonths').value) || 0;
  const preview = document.getElementById('interestPreview');
  if (!preview) return;

  if (!amount || !rate || !months) { preview.innerHTML = ''; return; }

  const r = rate / 100;
  const t = period === 'mensual' ? months : months * 2;
  let total;
  if (type === 'simple') total = amount * (1 + r * months / (period === 'mensual' ? 1 : 0.5));
  else total = amount * Math.pow(1 + r, months / (period === 'mensual' ? 1 : 0.5));

  const interest = total - amount;
  preview.innerHTML = `
    <div style="background:#1e293b;border-radius:8px;padding:0.8rem;margin-top:0.5rem;font-size:0.85rem;">
      <div style="display:flex;justify-content:space-between;"><span>Capital:</span><span>$${formatNumber(amount)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Interés:</span><span style="color:#f59e0b;">+$${formatNumber(interest)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid #334155;margin-top:0.4rem;padding-top:0.4rem;">
        <span>Total a ${document.getElementById('debtType').value === 'presto' ? 'cobrar' : 'pagar'}:</span>
        <span style="color:#22c55e;">$${formatNumber(total)}</span>
      </div>
    </div>`;
}

function renderDebts() {
  const debtList = document.getElementById('debtList');
  if (!debtList) return;
  debtList.innerHTML = '';

  if (db.debts.length === 0) { debtList.innerHTML = '<p style="color:#64748b;">No hay deudas registradas</p>'; return; }

  const groups = {
    presto: { label: '💸 Presté (me deben devolver)', color: '#3b82f6' },
    mePrestaron: { label: '📥 Me prestaron (debo devolver)', color: '#ef4444' },
    meDeben: { label: '🤝 Me deben (sin movimiento inicial)', color: '#22c55e' },
    debo: { label: '📤 Debo (sin movimiento inicial)', color: '#f59e0b' }
  };

  Object.keys(groups).forEach(cat => {
    const items = db.debts.filter(d => (d.debtCategory || d.type) === cat && d.remaining > 0);
    if (items.length === 0) return;
    debtList.innerHTML += `<h4 style="color:${groups[cat].color};margin:1rem 0 0.5rem;">${groups[cat].label}</h4>`;
    items.forEach(d => renderDebtItem(d, db.debts.indexOf(d), cat, groups[cat].color));
  });

  // Paid/closed debts
  const paidDebts = db.debts.filter(d => d.remaining <= 0);
  if (paidDebts.length > 0) {
    debtList.innerHTML += `<details style="margin-top:1rem;"><summary style="color:#64748b;cursor:pointer;">📁 Deudas saldadas (${paidDebts.length})</summary>`;
    paidDebts.forEach(d => {
      debtList.innerHTML += `
        <div style="background:#1e293b;border-radius:8px;padding:0.6rem;margin:0.3rem 0;opacity:0.6;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><strong>${d.title}</strong> <small style="color:#64748b;">· ${d.person}</small></div>
            <div>
              <span style="color:#22c55e;font-size:0.85rem;">✅ Saldado</span>
              <button class="danger" onclick="deleteDebt(${db.debts.indexOf(d)})" style="margin-left:0.5rem;padding:0.2rem 0.5rem;">🗑️</button>
            </div>
          </div>
          <div style="font-size:0.8rem;color:#94a3b8;">Total: $${formatNumber(d.amount)}</div>
        </div>`;
    });
    debtList.innerHTML += '</details>';
  }
}

function renderDebtItem(d, originalIndex, cat, color) {
  const debtList = document.getElementById('debtList');
  const [year, month, day] = (d.date || '----').split('-');
  const pct = d.amount > 0 ? ((d.amount - d.remaining) / d.amount * 100).toFixed(1) : 0;

  let interestInfo = '';
  if (d.hasInterest && d.interestRate > 0) {
    interestInfo = `
      <div style="font-size:0.8rem;color:#f59e0b;margin-top:0.3rem;">
        💰 ${d.interestType === 'compuesto' ? 'Interés compuesto' : 'Interés simple'} · ${d.interestRate}% ${d.interestPeriod}
        · Capital: $${formatNumber(d.principal || d.amount)}
      </div>`;
  }

  const payVerb = (cat === 'presto' || cat === 'meDeben') ? 'Cobrar abono' : 'Abonar pago';
  const payAllVerb = (cat === 'presto' || cat === 'meDeben') ? 'Cobrar todo' : 'Pagar todo';

  debtList.innerHTML += `
    <div class="card debt-item" data-index="${originalIndex}" data-type="${cat}" style="border-left:4px solid ${color};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <div>
          <b style="font-size:1rem;">${d.title}</b>
          <span style="font-size:0.8rem;color:#94a3b8;margin-left:0.5rem;">${d.person}</span>
        </div>
        <div style="display:flex;gap:0.4rem;">
          <button class="secondary" onclick="payFullDebt(${originalIndex})" style="font-size:0.8rem;padding:0.3rem 0.6rem;">${payAllVerb}</button>
          <button class="danger" onclick="deleteDebt(${originalIndex})" style="padding:0.3rem 0.6rem;">🗑️</button>
        </div>
      </div>
      ${d.desc ? `<p style="font-size:0.85rem;color:#94a3b8;margin:0.2rem 0;">${d.desc}</p>` : ''}
      <p style="margin:0.2rem 0;font-size:0.85rem;"><span style="color:#64748b;">Fecha:</span> ${day}/${month}/${year}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:0.3rem 0;">
        <span style="color:#64748b;font-size:0.85rem;">Total: $${formatNumber(d.amount)}</span>
        <span style="color:${color};font-weight:700;">Restante: $${formatNumber(d.remaining)}</span>
      </div>
      ${interestInfo}
      <div style="background:#1e293b;border-radius:999px;height:8px;margin:0.5rem 0;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:999px;"></div>
      </div>
      <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.5rem;">${pct}% pagado</div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <input type="text" id="p${originalIndex}" placeholder="${payVerb}" style="flex:1;padding:0.4rem;border-radius:4px;border:none;background:#1e293b;color:#e5e7eb;" inputmode="decimal" oninput="formatInputNumber(event)" />
        <button class="primary" onclick="payDebt(${originalIndex})" style="width:auto;padding:0.5rem 0.8rem;white-space:nowrap;">✔</button>
      </div>
    </div>`;
}

function payFullDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  if (confirm(`¿Registrar pago total de "${d.title}" por $${formatNumber(d.remaining)}?`)) payDebt(index, d.remaining);
}

function deleteDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  if (confirm(`¿Eliminar la deuda "${d.title}"?`)) {
    db.debts.splice(index, 1);
    saveDB();
  }
}

function payDebt(index, specificAmount = null) {
  const d = db.debts[index];
  if (!d) return;
  let amount;
  if (specificAmount !== null) amount = specificAmount;
  else {
    const inputEl = document.getElementById('p' + index);
    if (!inputEl || !inputEl.value) { alert('Ingresa un monto'); return; }
    amount = parseColombianNumber(inputEl.value);
  }
  if (amount <= 0 || amount > d.remaining) { alert('Monto inválido'); return; }

  d.remaining -= amount;
  const cat = d.debtCategory || d.type;
  const today = new Date().toISOString().slice(0, 10);

  // Movement type depends on category
  let movType, movTitle;
  if (cat === 'presto') { movType = 'ingreso'; movTitle = `Cobro préstamo: ${d.title}`; }
  else if (cat === 'mePrestaron') { movType = 'egreso'; movTitle = `Pago préstamo: ${d.title}`; }
  else if (cat === 'meDeben') { movType = 'ingreso'; movTitle = `Cobro: ${d.title}`; }
  else { movType = 'egreso'; movTitle = `Pago deuda: ${d.title}`; }

  db.movements.push({ id: Date.now(), date: today, type: movType, title: movTitle, desc: `Abono a ${d.person}`, amount });

  if (d.remaining <= 0) alert(`"${d.title}" saldado ✅`);
  saveDB();
  const inputEl = document.getElementById('p' + index);
  if (inputEl) inputEl.value = '';
}

// ============================================================
//  FILTER
// ============================================================
function renderFiltered() {
  const filterResults = document.getElementById('filterResults');
  const filterTitle = document.getElementById('filterTitle');
  const filterAmountInput = document.getElementById('filterAmount');
  const minAmount = parseColombianNumber(filterAmountInput.value);
  filterResults.innerHTML = '';
  const filtered = db.movements
    .filter(m => m.title.toLowerCase().includes(filterTitle.value.toLowerCase()) && m.amount >= minAmount)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filtered.length === 0) { filterResults.innerHTML = '<p>No se encontraron movimientos</p>'; return; }
  filtered.forEach(m => {
    const [year, month, day] = m.date.split('-');
    filterResults.innerHTML += `
      <div class="movement-item">
        <div>
          <strong>${day}/${month}/${year}</strong>
          <div>${m.title} - ${m.type === 'ingreso' ? '➕' : '➖'} $${formatNumber(m.amount)}</div>
          ${m.desc ? `<small>${m.desc}</small>` : ''}
        </div>
        <div class="movement-actions">
          <button class="secondary" onclick="editMovement(${m.id})">✏️</button>
          <button class="danger" onclick="deleteMovement(${m.id})">🗑️</button>
        </div>
      </div>`;
  });
}

// ============================================================
//  EXPORT / IMPORT
// ============================================================
function exportTXT() {
  const exportData = { movements: db.movements, debts: db.debts, incomeFunds: db.incomeFunds, fortnights: db.fortnights, fixedExpenses: db.fixedExpenses, predictions: db.predictions || [] };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
  a.download = 'finanzas_completas.json';
  a.click();
}

function importTXT() { document.getElementById('fileInput').click(); }

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (importedData.movements && Array.isArray(importedData.movements)) {
        const action = db.movements.length === 0 ? true : confirm('Aceptar: Añadir | Cancelar: Reemplazar');
        if (action) {
          db.movements.push(...importedData.movements);
          if (importedData.debts) db.debts.push(...importedData.debts);
          if (importedData.incomeFunds) db.incomeFunds.push(...importedData.incomeFunds);
          if (importedData.fortnights) db.fortnights.push(...(importedData.fortnights || []));
          if (importedData.fixedExpenses) db.fixedExpenses.push(...(importedData.fixedExpenses || []));
          if (importedData.predictions) db.predictions.push(...(importedData.predictions || []));
        } else {
          db.movements = importedData.movements;
          db.debts = importedData.debts || [];
          db.incomeFunds = importedData.incomeFunds || [];
          db.fortnights = importedData.fortnights || [];
          db.fixedExpenses = importedData.fixedExpenses || [];
          db.predictions = importedData.predictions || [];
        }
        saveDB();
        alert(`Importación exitosa: ${importedData.movements.length} movimientos`);
      }
    } catch (err) { alert('Error al importar el archivo.'); }
    input.value = '';
  };
  reader.readAsText(file);
}

// ============================================================
//  PREDICCIONES — Data & State
// ============================================================
if (!db.predictions) db.predictions = [];

let activePredId = null; // which prediction is open in detail view

// ── Helpers ─────────────────────────────────────────────────
function getMonthlyFixedExpenses() {
  if (!db.fixedExpenses) return 0;
  return db.fixedExpenses.reduce((sum, fe) => {
    return sum + (fe.period === 'quincenal' ? fe.amount * 2 : fe.amount);
  }, 0);
}

function getAvgMonthlyIncome() {
  const incomeMov = db.movements.filter(m => m.type === 'ingreso');
  if (incomeMov.length === 0) return 0;
  const monthTotals = {};
  incomeMov.forEach(m => {
    const key = m.date.slice(0, 7);
    monthTotals[key] = (monthTotals[key] || 0) + m.amount;
  });
  const vals = Object.values(monthTotals);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getAvgMonthlyExpenses() {
  const egMov = db.movements.filter(m => m.type === 'egreso');
  if (egMov.length === 0) return 0;
  const monthTotals = {};
  egMov.forEach(m => {
    const key = m.date.slice(0, 7);
    monthTotals[key] = (monthTotals[key] || 0) + m.amount;
  });
  const vals = Object.values(monthTotals);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getCurrentBalance() {
  return db.movements.reduce((t, m) => m.type === 'ingreso' ? t + m.amount : t - m.amount, 0);
}

function predTypeLabel(type) {
  return { ahorro: '🏦 Ahorro', deuda: '💳 Deuda', meta: '🎯 Meta', proyeccion: '📊 Proyección', escenarios: '⚖️ Escenarios' }[type] || type;
}

function predColorClass(type) {
  return { ahorro: '#22c55e', deuda: '#ef4444', meta: '#f59e0b', proyeccion: '#3b82f6', escenarios: '#8b5cf6' }[type] || '#6366f1';
}

// ── Save / Render list ───────────────────────────────────────
function savePrediction(pred) {
  if (!db.predictions) db.predictions = [];
  const idx = db.predictions.findIndex(p => p.id === pred.id);
  if (idx !== -1) db.predictions[idx] = pred;
  else db.predictions.push(pred);
  localStorage.setItem('financeDB', JSON.stringify(db));
  renderPredictionsList();
}

function deletePrediction(id) {
  if (!confirm('¿Eliminar esta predicción?')) return;
  db.predictions = db.predictions.filter(p => p.id !== id);
  localStorage.setItem('financeDB', JSON.stringify(db));
  if (activePredId === id) {
    activePredId = null;
    document.getElementById('predictionDetail').style.display = 'none';
  }
  renderPredictionsList();
}

function renderPredictionsList() {
  const list = document.getElementById('predictionsList');
  const empty = document.getElementById('predictionsEmpty');
  if (!list) return;
  const preds = db.predictions || [];
  if (preds.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = preds.map(p => {
    const color = predColorClass(p.type);
    const typeLabel = predTypeLabel(p.type);
    const resultText = getPredCardResult(p);
    return `
      <div class="pred-card type-${p.type}" onclick="openPredictionDetail('${p.id}')">
        <div class="pred-card-top">
          <div>
            <div class="pred-card-name">${p.name}</div>
            <div class="pred-card-type">${typeLabel}</div>
          </div>
          <div class="pred-card-actions" onclick="event.stopPropagation()">
            <button class="danger" onclick="deletePrediction('${p.id}')" style="padding:0.3rem 0.6rem;font-size:0.8rem;">🗑️</button>
          </div>
        </div>
        <div class="pred-card-result" style="color:${color}">${resultText.main}</div>
        <div class="pred-card-meta">${resultText.sub}</div>
      </div>`;
  }).join('');
}

function getPredCardResult(p) {
  try {
    switch (p.type) {
      case 'ahorro': {
        const r = calcAhorro(p.params);
        return { main: `$${formatNumber(r.totalAhorro)}`, sub: `en ${p.params.meses} meses` };
      }
      case 'deuda': {
        const r = calcDeuda(p.params);
        return { main: `$${formatNumber(r.totalIntereses)}`, sub: `en intereses · ${p.params.plazo} cuotas` };
      }
      case 'meta': {
        const r = calcMeta(p.params);
        return { main: r.mesesNecesarios <= 0 ? 'Ya tienes suficiente' : `${r.mesesNecesarios} meses`, sub: `para $${formatNumber(p.params.meta)}` };
      }
      case 'proyeccion': {
        const r = calcProyeccion(p.params);
        const last = r.meses[r.meses.length - 1];
        return { main: `$${formatNumber(last.balance)}`, sub: `balance en mes ${r.meses.length}` };
      }
      case 'escenarios': {
        const rA = calcEscenario(p.params, 'A');
        const rB = calcEscenario(p.params, 'B');
        return { main: `A: $${formatNumber(rA.balance)} · B: $${formatNumber(rB.balance)}`, sub: `en ${p.params.meses} meses` };
      }
    }
  } catch (e) {}
  return { main: '—', sub: '' };
}

// ── Open / Close modals ──────────────────────────────────────
function openNewPredictionModal() {
  document.getElementById('newPredictionModal').style.display = 'flex';
}
function closeNewPredictionModal() {
  document.getElementById('newPredictionModal').style.display = 'none';
}
function closePredictionFormModal() {
  document.getElementById('predictionFormModal').style.display = 'none';
}
function toggleGlossary() {
  const el = document.getElementById('glossaryContent');
  const arrow = document.getElementById('glossaryArrow');
  if (el.style.display === 'none') { el.style.display = 'block'; arrow.textContent = '▲'; }
  else { el.style.display = 'none'; arrow.textContent = '▼'; }
}

// ── Start new prediction ─────────────────────────────────────
function startPrediction(type) {
  closeNewPredictionModal();
  const avgIncome = getAvgMonthlyIncome();
  const avgFixed = getMonthlyFixedExpenses();
  const balance = getCurrentBalance();
  const content = document.getElementById('predictionFormContent');

  const fixedList = (db.fixedExpenses || []).map((fe, i) =>
    `<label style="display:flex;align-items:center;gap:0.5rem;background:#0f172a;border-radius:6px;padding:0.4rem 0.6rem;margin:0.2rem 0;font-size:0.85rem;color:#94a3b8;">
      <input type="checkbox" class="pred-fe-check" data-amount="${fe.amount}" data-period="${fe.period}" style="width:auto;margin:0;accent-color:#6366f1;" checked />
      ${fe.title} — $${formatNumber(fe.amount)} (${fe.period})
    </label>`).join('');
  const hasFixed = (db.fixedExpenses || []).length > 0;

  let html = '';
  switch (type) {
    case 'ahorro':
      html = `
        <h3 style="margin-bottom:0.2rem;">🏦 Simulador de Ahorro</h3>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:1rem;">Proyecta cuánto acumularás con aportes periódicos.</p>
        <label class="pred-form-label">Nombre de esta predicción</label>
        <input id="pf-name" placeholder="Ej: Ahorro 2025" value="Mi ahorro" />
        <label class="pred-form-label">Saldo inicial ($)</label>
        <input type="text" id="pf-saldo" placeholder="Saldo actual" inputmode="decimal" value="${formatNumber(Math.max(0, balance))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Ingreso mensual ($)</label>
        <input type="text" id="pf-ingreso" placeholder="Ingreso mensual" inputmode="decimal" value="${formatNumber(Math.round(avgIncome))}" oninput="formatInputNumber(event)" />
        ${hasFixed ? `<label class="pred-form-label" style="margin-top:0.6rem;">Gastos fijos a incluir</label><div style="background:#1e293b;border-radius:8px;padding:0.6rem;margin-bottom:0.4rem;">${fixedList}</div>` : ''}
        <label class="pred-form-label">Gastos adicionales / mes ($)</label>
        <input type="text" id="pf-gastos" placeholder="Otros gastos mensuales" inputmode="decimal" value="${formatNumber(Math.max(0, Math.round(getAvgMonthlyExpenses() - avgFixed)))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Porcentaje a ahorrar del sobrante (%)</label>
        <input type="number" id="pf-pct" placeholder="Ej: 30" value="30" min="0" max="100" />
        <label class="pred-form-label">Plazo (meses)</label>
        <input type="number" id="pf-meses" placeholder="Ej: 12" value="12" min="1" max="360" />
        <div class="pred-toggle-row">
          <input type="checkbox" id="pf-interes" style="width:auto;margin:0;accent-color:#6366f1;" />
          <span>¿Incluir rendimiento de ahorro?</span>
        </div>
        <div id="pf-interes-wrap" style="display:none;">
          <label class="pred-form-label">Tasa mensual (%)</label>
          <input type="number" id="pf-tasa" placeholder="Ej: 0.5" value="0.5" step="0.01" min="0" />
        </div>
        <button class="primary" onclick="runPrediction('ahorro')" style="margin-top:0.8rem;">Calcular</button>
        <button onclick="closePredictionFormModal()" class="secondary" style="margin-top:0.4rem;width:100%;">Cancelar</button>`;
      break;

    case 'deuda':
      html = `
        <h3 style="margin-bottom:0.2rem;">💳 Calculadora de Deuda</h3>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:1rem;">Amortización con sistema francés y alemán según normativa colombiana.</p>
        <label class="pred-form-label">Nombre de esta predicción</label>
        <input id="pf-name" placeholder="Ej: Crédito carro" value="Mi crédito" />
        <label class="pred-form-label">Capital ($)</label>
        <input type="text" id="pf-capital" placeholder="Monto del préstamo" inputmode="decimal" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Tasa de interés mensual (%)</label>
        <input type="number" id="pf-tasa" placeholder="Ej: 1.8" value="1.8" step="0.01" min="0" />
        <label class="pred-form-label">Plazo (meses)</label>
        <input type="number" id="pf-plazo" placeholder="Ej: 24" value="24" min="1" max="360" />
        <label class="pred-form-label">Sistema de amortización</label>
        <select id="pf-sistema">
          <option value="frances">Francés (cuota fija) — estándar Colombia</option>
          <option value="aleman">Alemán (capital fijo)</option>
        </select>
        <label class="pred-form-label">Pago adicional mensual ($, opcional)</label>
        <input type="text" id="pf-extra" placeholder="0" inputmode="decimal" value="0" oninput="formatInputNumber(event)" />
        <button class="primary" onclick="runPrediction('deuda')" style="margin-top:0.8rem;">Calcular tabla</button>
        <button onclick="closePredictionFormModal()" class="secondary" style="margin-top:0.4rem;width:100%;">Cancelar</button>`;
      break;

    case 'meta':
      html = `
        <h3 style="margin-bottom:0.2rem;">🎯 Meta Financiera</h3>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:1rem;">¿Cuándo llegas a tu objetivo de ahorro?</p>
        <label class="pred-form-label">Nombre de esta predicción</label>
        <input id="pf-name" placeholder="Ej: Vacaciones" value="Mi meta" />
        <label class="pred-form-label">Meta ($)</label>
        <input type="text" id="pf-meta" placeholder="Cuánto quieres tener" inputmode="decimal" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Saldo actual ($)</label>
        <input type="text" id="pf-saldo" placeholder="Lo que tienes hoy" inputmode="decimal" value="${formatNumber(Math.max(0, balance))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Ingreso mensual ($)</label>
        <input type="text" id="pf-ingreso" placeholder="Ingreso mensual" inputmode="decimal" value="${formatNumber(Math.round(avgIncome))}" oninput="formatInputNumber(event)" />
        ${hasFixed ? `<label class="pred-form-label" style="margin-top:0.6rem;">Gastos fijos a incluir</label><div style="background:#1e293b;border-radius:8px;padding:0.6rem;margin-bottom:0.4rem;">${fixedList}</div>` : ''}
        <label class="pred-form-label">Gastos adicionales / mes ($)</label>
        <input type="text" id="pf-gastos" placeholder="Otros gastos" inputmode="decimal" value="${formatNumber(Math.max(0, Math.round(getAvgMonthlyExpenses() - avgFixed)))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">% del sobrante que ahorrarás</label>
        <input type="number" id="pf-pct" placeholder="Ej: 50" value="50" min="1" max="100" />
        <button class="primary" onclick="runPrediction('meta')" style="margin-top:0.8rem;">Calcular</button>
        <button onclick="closePredictionFormModal()" class="secondary" style="margin-top:0.4rem;width:100%;">Cancelar</button>`;
      break;

    case 'proyeccion':
      html = `
        <h3 style="margin-bottom:0.2rem;">📊 Proyección Mensual</h3>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:1rem;">Simula tu balance mes a mes si nada cambia.</p>
        <label class="pred-form-label">Nombre de esta predicción</label>
        <input id="pf-name" placeholder="Ej: Proyección 2025" value="Proyección" />
        <label class="pred-form-label">Saldo inicial ($)</label>
        <input type="text" id="pf-saldo" placeholder="Saldo hoy" inputmode="decimal" value="${formatNumber(Math.max(0, balance))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Ingreso mensual ($)</label>
        <input type="text" id="pf-ingreso" placeholder="Ingreso mensual" inputmode="decimal" value="${formatNumber(Math.round(avgIncome))}" oninput="formatInputNumber(event)" />
        ${hasFixed ? `<label class="pred-form-label" style="margin-top:0.6rem;">Gastos fijos a incluir</label><div style="background:#1e293b;border-radius:8px;padding:0.6rem;margin-bottom:0.4rem;">${fixedList}</div>` : ''}
        <label class="pred-form-label">Gastos adicionales / mes ($)</label>
        <input type="text" id="pf-gastos" placeholder="Otros gastos" inputmode="decimal" value="${formatNumber(Math.max(0, Math.round(getAvgMonthlyExpenses() - avgFixed)))}" oninput="formatInputNumber(event)" />
        <label class="pred-form-label">Proyectar (meses)</label>
        <input type="number" id="pf-meses" placeholder="Ej: 12" value="12" min="1" max="120" />
        <button class="primary" onclick="runPrediction('proyeccion')" style="margin-top:0.8rem;">Proyectar</button>
        <button onclick="closePredictionFormModal()" class="secondary" style="margin-top:0.4rem;width:100%;">Cancelar</button>`;
      break;

    case 'escenarios':
      html = `
        <h3 style="margin-bottom:0.2rem;">⚖️ Comparar Escenarios</h3>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:1rem;">Compara dos situaciones financieras en paralelo.</p>
        <label class="pred-form-label">Nombre de esta predicción</label>
        <input id="pf-name" placeholder="Ej: ¿Aumento gastos?" value="Comparación" />
        <label class="pred-form-label">Plazo a comparar (meses)</label>
        <input type="number" id="pf-meses" value="12" min="1" max="120" />
        <label class="pred-form-label">Saldo inicial compartido ($)</label>
        <input type="text" id="pf-saldo" inputmode="decimal" value="${formatNumber(Math.max(0, balance))}" oninput="formatInputNumber(event)" />
        <div style="background:#1e293b;border-radius:10px;padding:0.8rem;margin:0.6rem 0;">
          <div style="color:#22c55e;font-weight:700;font-size:0.85rem;margin-bottom:0.5rem;">🟢 Escenario A</div>
          <label class="pred-form-label">Ingreso mensual A ($)</label>
          <input type="text" id="pf-ingresoA" inputmode="decimal" value="${formatNumber(Math.round(avgIncome))}" oninput="formatInputNumber(event)" />
          <label class="pred-form-label">Gastos totales / mes A ($)</label>
          <input type="text" id="pf-gastosA" inputmode="decimal" value="${formatNumber(Math.round(getAvgMonthlyExpenses()))}" oninput="formatInputNumber(event)" />
        </div>
        <div style="background:#1e293b;border-radius:10px;padding:0.8rem;margin:0.6rem 0;">
          <div style="color:#8b5cf6;font-weight:700;font-size:0.85rem;margin-bottom:0.5rem;">🟣 Escenario B</div>
          <label class="pred-form-label">Ingreso mensual B ($)</label>
          <input type="text" id="pf-ingresoB" inputmode="decimal" value="${formatNumber(Math.round(avgIncome))}" oninput="formatInputNumber(event)" />
          <label class="pred-form-label">Gastos totales / mes B ($)</label>
          <input type="text" id="pf-gastosB" inputmode="decimal" value="${formatNumber(Math.round(getAvgMonthlyExpenses() * 1.2))}" oninput="formatInputNumber(event)" />
        </div>
        <button class="primary" onclick="runPrediction('escenarios')" style="margin-top:0.8rem;">Comparar</button>
        <button onclick="closePredictionFormModal()" class="secondary" style="margin-top:0.4rem;width:100%;">Cancelar</button>`;
      break;
  }

  content.innerHTML = html;
  document.getElementById('predictionFormModal').style.display = 'flex';

  // Toggle interest field for ahorro
  const cb = document.getElementById('pf-interes');
  if (cb) cb.addEventListener('change', () => {
    document.getElementById('pf-interes-wrap').style.display = cb.checked ? 'block' : 'none';
  });

  setTimeout(initAutoFormat, 50);
}

// ── Calculations ─────────────────────────────────────────────
function getCheckedFixedTotal() {
  let total = 0;
  document.querySelectorAll('.pred-fe-check:checked').forEach(cb => {
    const amount = parseFloat(cb.dataset.amount) || 0;
    const period = cb.dataset.period;
    total += period === 'quincenal' ? amount * 2 : amount;
  });
  return total;
}

function calcAhorro(p) {
  const { saldo, ingreso, gastosExtra, pctAhorro, meses, tasa, incluirTasa, fixedTotal } = p;
  const totalGastos = fixedTotal + gastosExtra;
  const sobrante = ingreso - totalGastos;
  const aporteMensual = Math.max(0, sobrante * (pctAhorro / 100));
  let balance = saldo;
  const timeline = [];
  const tasaMes = (tasa || 0) / 100;
  for (let i = 1; i <= meses; i++) {
    if (incluirTasa && tasaMes > 0) balance *= (1 + tasaMes);
    balance += aporteMensual;
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    timeline.push({ mes: i, label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), balance });
  }
  return { totalAhorro: balance, aporteMensual, sobrante, timeline };
}

function calcDeuda(p) {
  const { capital, tasa, plazo, sistema, extra } = p;
  const r = tasa / 100;
  const rows = [];
  let saldo = capital;
  let totalIntereses = 0;
  let totalPagado = 0;
  const cuotaFija = sistema === 'frances'
    ? capital * (r * Math.pow(1 + r, plazo)) / (Math.pow(1 + r, plazo) - 1)
    : null;
  const capitalFijo = sistema === 'aleman' ? capital / plazo : null;

  for (let i = 1; i <= plazo; i++) {
    if (saldo <= 0) break;
    const interes = saldo * r;
    let cuota, capPagado;
    if (sistema === 'frances') {
      cuota = cuotaFija + (extra || 0);
      capPagado = Math.min(cuota - interes, saldo);
    } else {
      capPagado = Math.min(capitalFijo + (extra || 0), saldo);
      cuota = capPagado + interes;
    }
    saldo -= capPagado;
    if (saldo < 0) saldo = 0;
    totalIntereses += interes;
    totalPagado += cuota;
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    rows.push({ mes: i, label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), cuota, interes, capital: capPagado, saldo });
    if (saldo <= 0.01) break;
  }
  return { rows, totalIntereses, totalPagado, cuotaFija: cuotaFija || (capitalFijo + capital * r) };
}

function calcMeta(p) {
  const { meta, saldo, ingreso, gastosExtra, pctAhorro, fixedTotal } = p;
  const totalGastos = fixedTotal + gastosExtra;
  const sobrante = ingreso - totalGastos;
  const aporteMensual = Math.max(0, sobrante * (pctAhorro / 100));
  if (aporteMensual <= 0) return { mesesNecesarios: -1, aporteMensual, sobrante, pctNecesario: null };
  let balance = saldo;
  let meses = 0;
  const MAX = 600;
  while (balance < meta && meses < MAX) { balance += aporteMensual; meses++; }
  const pctNecesario = sobrante > 0 ? Math.ceil(((meta - saldo) / sobrante) * 100 / meses) : null;
  const fechaMeta = new Date();
  fechaMeta.setMonth(fechaMeta.getMonth() + meses);
  return { mesesNecesarios: meses, aporteMensual, sobrante, pctNecesario, fechaMeta, balanceFinal: balance };
}

function calcProyeccion(p) {
  const { saldo, ingreso, gastosExtra, meses, fixedTotal } = p;
  const totalGastos = fixedTotal + gastosExtra;
  let balance = saldo;
  const timeline = [];
  for (let i = 1; i <= meses; i++) {
    balance += ingreso - totalGastos;
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    timeline.push({ mes: i, label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), balance, ingreso, gastos: totalGastos });
  }
  return { meses: timeline };
}

function calcEscenario(p, which) {
  const ingreso = which === 'A' ? p.ingresoA : p.ingresoB;
  const gastos = which === 'A' ? p.gastosA : p.gastosB;
  let balance = p.saldo;
  const timeline = [];
  for (let i = 1; i <= p.meses; i++) {
    balance += ingreso - gastos;
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    timeline.push({ mes: i, label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), balance });
  }
  return { balance, timeline };
}

// ── Run & Save ───────────────────────────────────────────────
function runPrediction(type) {
  const name = (document.getElementById('pf-name')?.value || type).trim();
  let params = {};
  try {
    switch (type) {
      case 'ahorro':
        params = {
          saldo: parseColombianNumber(document.getElementById('pf-saldo').value),
          ingreso: parseColombianNumber(document.getElementById('pf-ingreso').value),
          fixedTotal: getCheckedFixedTotal(),
          gastosExtra: parseColombianNumber(document.getElementById('pf-gastos').value),
          pctAhorro: parseFloat(document.getElementById('pf-pct').value) || 0,
          meses: parseInt(document.getElementById('pf-meses').value) || 12,
          incluirTasa: document.getElementById('pf-interes')?.checked || false,
          tasa: parseFloat(document.getElementById('pf-tasa')?.value) || 0
        }; break;
      case 'deuda':
        params = {
          capital: parseColombianNumber(document.getElementById('pf-capital').value),
          tasa: parseFloat(document.getElementById('pf-tasa').value) || 0,
          plazo: parseInt(document.getElementById('pf-plazo').value) || 12,
          sistema: document.getElementById('pf-sistema').value,
          extra: parseColombianNumber(document.getElementById('pf-extra').value)
        };
        if (!params.capital) { alert('Ingresa el capital'); return; }
        break;
      case 'meta':
        params = {
          meta: parseColombianNumber(document.getElementById('pf-meta').value),
          saldo: parseColombianNumber(document.getElementById('pf-saldo').value),
          ingreso: parseColombianNumber(document.getElementById('pf-ingreso').value),
          fixedTotal: getCheckedFixedTotal(),
          gastosExtra: parseColombianNumber(document.getElementById('pf-gastos').value),
          pctAhorro: parseFloat(document.getElementById('pf-pct').value) || 50
        };
        if (!params.meta) { alert('Ingresa la meta'); return; }
        break;
      case 'proyeccion':
        params = {
          saldo: parseColombianNumber(document.getElementById('pf-saldo').value),
          ingreso: parseColombianNumber(document.getElementById('pf-ingreso').value),
          fixedTotal: getCheckedFixedTotal(),
          gastosExtra: parseColombianNumber(document.getElementById('pf-gastos').value),
          meses: parseInt(document.getElementById('pf-meses').value) || 12
        }; break;
      case 'escenarios':
        params = {
          meses: parseInt(document.getElementById('pf-meses').value) || 12,
          saldo: parseColombianNumber(document.getElementById('pf-saldo').value),
          ingresoA: parseColombianNumber(document.getElementById('pf-ingresoA').value),
          gastosA: parseColombianNumber(document.getElementById('pf-gastosA').value),
          ingresoB: parseColombianNumber(document.getElementById('pf-ingresoB').value),
          gastosB: parseColombianNumber(document.getElementById('pf-gastosB').value)
        }; break;
    }
  } catch (e) { alert('Error en los datos'); return; }

  const pred = { id: String(Date.now()), type, name, params, createdAt: new Date().toISOString() };
  savePrediction(pred);
  closePredictionFormModal();
  openPredictionDetail(pred.id);
}

// ── Detail view ──────────────────────────────────────────────
function openPredictionDetail(id) {
  activePredId = id;
  const pred = (db.predictions || []).find(p => p.id === id);
  if (!pred) return;
  const detail = document.getElementById('predictionDetail');
  detail.style.display = 'block';
  detail.innerHTML = buildDetailHTML(pred);
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildDetailHTML(pred) {
  const color = predColorClass(pred.type);
  let body = '';
  try {
    switch (pred.type) {
      case 'ahorro': body = buildAhorroDetail(pred); break;
      case 'deuda':  body = buildDeudaDetail(pred);  break;
      case 'meta':   body = buildMetaDetail(pred);   break;
      case 'proyeccion': body = buildProyeccionDetail(pred); break;
      case 'escenarios': body = buildEscenariosDetail(pred); break;
    }
  } catch(e) { body = `<p style="color:#ef4444;">Error al calcular: ${e.message}</p>`; }

  return `
    <button class="pred-back-btn" onclick="document.getElementById('predictionDetail').style.display='none';activePredId=null;">◀ Volver a predicciones</button>
    <div class="card" style="border:1px solid ${color}33;">
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:#f1f5f9;">${pred.name}</div>
          <div style="font-size:0.75rem;color:#64748b;">${predTypeLabel(pred.type)} · ${new Date(pred.createdAt).toLocaleDateString('es-CO')}</div>
        </div>
      </div>
      ${body}
    </div>`;
}

function buildAhorroDetail(pred) {
  const p = pred.params;
  const r = calcAhorro(p);
  const pct = Math.min(100, ((r.totalAhorro - p.saldo) / r.totalAhorro * 100)).toFixed(1);
  const timeline = r.timeline.filter((_, i) => i % Math.max(1, Math.floor(r.timeline.length / 8)) === 0 || i === r.timeline.length - 1);
  return `
    <div class="pred-result-box">
      <div class="pred-result-label">Total acumulado en ${p.meses} meses</div>
      <div class="pred-result-value" style="color:#22c55e;">$${formatNumber(Math.round(r.totalAhorro))}</div>
      <div class="pred-result-sub">empezando con $${formatNumber(p.saldo)}</div>
    </div>
    <div class="pred-chips">
      <div class="pred-chip">Aporte/mes <strong>$${formatNumber(Math.round(r.aporteMensual))}</strong></div>
      <div class="pred-chip">Sobrante mensual <strong>$${formatNumber(Math.round(r.sobrante))}</strong></div>
      <div class="pred-chip">Gastos fijos <strong>$${formatNumber(p.fixedTotal)}</strong></div>
      <div class="pred-chip">% a ahorrar <strong>${p.pctAhorro}%</strong></div>
      ${p.incluirTasa ? `<div class="pred-chip">Tasa mensual <strong>${p.tasa}%</strong></div>` : ''}
    </div>
    <div class="pred-progress-wrap"><div class="pred-progress-fill" style="width:${pct}%;background:#22c55e;"></div></div>
    <div style="font-size:0.78rem;color:#64748b;margin-bottom:0.8rem;">${pct}% son nuevos aportes</div>
    <div style="font-size:0.82rem;font-weight:700;color:#94a3b8;margin-bottom:0.5rem;">Evolución</div>
    <div class="pred-timeline">
      ${timeline.map(t => `
        <div class="pred-timeline-row">
          <span class="pred-timeline-month">${t.label}</span>
          <span class="pred-timeline-amount" style="color:#22c55e;">$${formatNumber(Math.round(t.balance))}</span>
        </div>`).join('')}
    </div>`;
}

function buildDeudaDetail(pred) {
  const p = pred.params;
  const r = calcDeuda(p);
  const showRows = r.rows.slice(0, 24);
  const extraInfo = p.extra > 0
    ? `<div class="pred-chip">Pago extra/mes <strong>$${formatNumber(p.extra)}</strong></div><div class="pred-chip">Cuotas reducidas <strong>${r.rows.length} de ${p.plazo}</strong></div>`
    : '';
  return `
    <div class="pred-result-box">
      <div class="pred-result-label">Total de intereses a pagar</div>
      <div class="pred-result-value" style="color:#ef4444;">$${formatNumber(Math.round(r.totalIntereses))}</div>
      <div class="pred-result-sub">sobre un capital de $${formatNumber(p.capital)}</div>
    </div>
    <div class="pred-chips">
      <div class="pred-chip">Cuota inicial <strong>$${formatNumber(Math.round(r.rows[0]?.cuota || 0))}</strong></div>
      <div class="pred-chip">Total pagado <strong>$${formatNumber(Math.round(r.totalPagado))}</strong></div>
      <div class="pred-chip">Sistema <strong>${p.sistema === 'frances' ? 'Francés' : 'Alemán'}</strong></div>
      <div class="pred-chip">Tasa mensual <strong>${p.tasa}%</strong></div>
      ${extraInfo}
    </div>
    <div style="font-size:0.82rem;color:#64748b;margin-bottom:0.5rem;">💡 En Colombia, la tasa máxima legal (usura) es certificada mensualmente por la Superfinanciera. Verifica que tu tasa esté dentro del límite.</div>
    <div class="amort-table-wrap">
      <table class="amort-table">
        <thead><tr>
          <th>#</th><th>Fecha</th><th>Cuota</th>
          <th class="amort-capital">Capital</th>
          <th class="amort-interest">Interés</th>
          <th>Saldo</th>
        </tr></thead>
        <tbody>
          ${showRows.map((row, i) => `
            <tr class="${i % 2 === 1 ? 'amort-highlight' : ''}">
              <td>${row.mes}</td>
              <td>${row.label}</td>
              <td>$${formatNumber(Math.round(row.cuota))}</td>
              <td class="amort-capital">$${formatNumber(Math.round(row.capital))}</td>
              <td class="amort-interest">$${formatNumber(Math.round(row.interes))}</td>
              <td>$${formatNumber(Math.round(row.saldo))}</td>
            </tr>`).join('')}
          ${r.rows.length > 24 ? `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:0.8rem;">... y ${r.rows.length - 24} cuotas más</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
}

function buildMetaDetail(pred) {
  const p = pred.params;
  const r = calcMeta(p);
  if (r.mesesNecesarios < 0) {
    return `
      <div class="pred-result-box">
        <div class="pred-result-label">Resultado</div>
        <div class="pred-result-value" style="color:#f59e0b;">Sin ahorro posible</div>
        <div class="pred-result-sub">Tus gastos superan tu ingreso</div>
      </div>
      <div class="pred-chips">
        <div class="pred-chip">Sobrante <strong style="color:#ef4444;">$${formatNumber(Math.round(r.sobrante))}</strong></div>
      </div>`;
  }
  const pctAlcanzado = Math.min(100, (p.saldo / p.meta * 100)).toFixed(1);
  const fechaStr = r.fechaMeta ? r.fechaMeta.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : '';
  return `
    <div class="pred-result-box">
      <div class="pred-result-label">Tiempo para alcanzar tu meta</div>
      <div class="pred-result-value" style="color:#f59e0b;">${r.mesesNecesarios} ${r.mesesNecesarios === 1 ? 'mes' : 'meses'}</div>
      <div class="pred-result-sub">Llegas en ${fechaStr}</div>
    </div>
    <div class="pred-chips">
      <div class="pred-chip">Meta <strong>$${formatNumber(p.meta)}</strong></div>
      <div class="pred-chip">Aporte/mes <strong>$${formatNumber(Math.round(r.aporteMensual))}</strong></div>
      <div class="pred-chip">Sobrante <strong>$${formatNumber(Math.round(r.sobrante))}</strong></div>
      <div class="pred-chip">% del sobrante <strong>${p.pctAhorro}%</strong></div>
    </div>
    <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:0.3rem;">Progreso actual hacia la meta</div>
    <div class="pred-progress-wrap"><div class="pred-progress-fill" style="width:${pctAlcanzado}%;background:#f59e0b;"></div></div>
    <div style="font-size:0.78rem;color:#64748b;margin-bottom:0.8rem;">${pctAlcanzado}% completado ($${formatNumber(p.saldo)} de $${formatNumber(p.meta)})</div>`;
}

function buildProyeccionDetail(pred) {
  const p = pred.params;
  const r = calcProyeccion(p);
  const hasNegative = r.meses.some(m => m.balance < 0);
  const last = r.meses[r.meses.length - 1];
  const color = last.balance >= 0 ? '#3b82f6' : '#ef4444';
  return `
    <div class="pred-result-box">
      <div class="pred-result-label">Balance al mes ${p.meses}</div>
      <div class="pred-result-value" style="color:${color};">$${formatNumber(Math.round(last.balance))}</div>
      <div class="pred-result-sub">partiendo de $${formatNumber(p.saldo)}</div>
    </div>
    <div class="pred-chips">
      <div class="pred-chip">Ingreso/mes <strong>$${formatNumber(p.ingreso)}</strong></div>
      <div class="pred-chip">Gastos/mes <strong>$${formatNumber(p.fixedTotal + p.gastosExtra)}</strong></div>
      <div class="pred-chip">Sobrante <strong style="color:${(p.ingreso - p.fixedTotal - p.gastosExtra) >= 0 ? '#22c55e' : '#ef4444'};">$${formatNumber(p.ingreso - p.fixedTotal - p.gastosExtra)}</strong></div>
    </div>
    ${hasNegative ? `<div style="background:#1c0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:0.7rem;font-size:0.82rem;color:#fca5a5;margin-bottom:0.8rem;">⚠️ Tu balance entra en negativo en algún mes. Considera reducir gastos o aumentar ingresos.</div>` : ''}
    <div class="pred-timeline">
      ${r.meses.map(m => {
        const neg = m.balance < 0;
        return `<div class="pred-timeline-row ${neg ? 'negative' : ''}">
          <span class="pred-timeline-month">${m.label}</span>
          <span class="pred-timeline-amount" style="color:${neg ? '#ef4444' : '#3b82f6'};">$${formatNumber(Math.round(m.balance))}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function buildEscenariosDetail(pred) {
  const p = pred.params;
  const rA = calcEscenario(p, 'A');
  const rB = calcEscenario(p, 'B');
  const diff = rA.balance - rB.balance;
  const winner = diff > 0 ? 'A' : diff < 0 ? 'B' : 'Empate';
  return `
    <div class="pred-chips" style="margin-bottom:0.5rem;">
      <div class="pred-chip">Plazo <strong>${p.meses} meses</strong></div>
      <div class="pred-chip">Saldo inicial <strong>$${formatNumber(p.saldo)}</strong></div>
    </div>
    <div class="scenario-cols">
      <div class="scenario-col">
        <div class="scenario-col-label a">🟢 Escenario A</div>
        <div class="scenario-col-value" style="color:#22c55e;">$${formatNumber(Math.round(rA.balance))}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:0.3rem;">
          Ingreso: $${formatNumber(p.ingresoA)}<br>
          Gastos: $${formatNumber(p.gastosA)}<br>
          Sobrante/mes: $${formatNumber(p.ingresoA - p.gastosA)}
        </div>
      </div>
      <div class="scenario-col">
        <div class="scenario-col-label b">🟣 Escenario B</div>
        <div class="scenario-col-value" style="color:#8b5cf6;">$${formatNumber(Math.round(rB.balance))}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:0.3rem;">
          Ingreso: $${formatNumber(p.ingresoB)}<br>
          Gastos: $${formatNumber(p.gastosB)}<br>
          Sobrante/mes: $${formatNumber(p.ingresoB - p.gastosB)}
        </div>
      </div>
    </div>
    ${winner !== 'Empate' ? `
    <div style="background:#1e293b;border-radius:10px;padding:0.8rem;text-align:center;margin:0.6rem 0;">
      <div style="font-size:0.78rem;color:#64748b;">Escenario ganador (más ahorro)</div>
      <div style="font-size:1.2rem;font-weight:800;color:${winner === 'A' ? '#22c55e' : '#8b5cf6'};">
        ${winner === 'A' ? '🟢 A gana' : '🟣 B gana'} por $${formatNumber(Math.abs(Math.round(diff)))}
      </div>
    </div>` : ''}
    <div style="font-size:0.82rem;font-weight:700;color:#94a3b8;margin:0.8rem 0 0.4rem;">Evolución comparada</div>
    <div class="pred-timeline">
      ${rA.timeline.filter((_, i) => i % Math.max(1, Math.floor(rA.timeline.length / 8)) === 0 || i === rA.timeline.length - 1).map((mA, i) => {
        const mB = rB.timeline[mA.mes - 1];
        return `<div class="pred-timeline-row">
          <span class="pred-timeline-month">${mA.label}</span>
          <span style="font-size:0.78rem;">
            <span style="color:#22c55e;">A: $${formatNumber(Math.round(mA.balance))}</span>
            &nbsp;·&nbsp;
            <span style="color:#8b5cf6;">B: $${formatNumber(Math.round(mB?.balance || 0))}</span>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

// ============================================================
//  VIEW NAVIGATION
// ============================================================
function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (id === 'calendar') {
    renderCalendarSection();
    toggleIncomeSelect();
  }
  if (id === 'predictions') {
    renderPredictionsList();
  }
  setTimeout(initAutoFormat, 10);
}

// ============================================================
//  PERIOD SUMMARY (for non-daily modes)
// ============================================================
function renderPeriodSummary() {
  renderPeriodView();
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  if (!db.fortnights) db.fortnights = [];
  if (!db.fixedExpenses) db.fixedExpenses = [];
  if (!db.predictions) db.predictions = [];

  // Set mode selector
  const modeSelect = document.getElementById('calendarModeSelect');
  if (modeSelect) modeSelect.value = calendarMode;

  updateIncomeFunds();
  updateBalance();
  renderCalendarSection();
  renderDebts();
  renderChart();
  renderSummaryCards();
  populateMonthSelect();
  renderPredictionsList();

  const today = new Date().toISOString().slice(0, 10);
  const movDate = document.getElementById('movDate');
  if (movDate) movDate.value = today;
  const debtDate = document.getElementById('debtDate');
  if (debtDate) debtDate.value = today;

  initAutoFormat();
  toggleIncomeSelect();

  document.getElementById('movementModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
  document.getElementById('incomeDetailModal').addEventListener('click', function(e) { if (e.target === this) closeIncomeModal(); });
  document.getElementById('startPeriodModal').addEventListener('click', function(e) { if (e.target === this) closeStartPeriodModal(); });
  document.getElementById('fixedExpenseModal').addEventListener('click', function(e) { if (e.target === this) closeFixedExpenseModal(); });
  document.getElementById('newPredictionModal').addEventListener('click', function(e) { if (e.target === this) closeNewPredictionModal(); });
  document.getElementById('predictionFormModal').addEventListener('click', function(e) { if (e.target === this) closePredictionFormModal(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/Finanzas_basicas/sw.js');
});