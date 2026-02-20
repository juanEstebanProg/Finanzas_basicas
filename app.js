const db = JSON.parse(localStorage.getItem('financeDB')) || {
  movements: [],
  debts: [],
  incomeFunds: []
};

let currentDate = new Date();
let chart;
let chartType = 'pie';
let selectedDay = null;

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

function parseColombianNumber(str) {
  if (!str) return 0;
  const cleanStr = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanStr) || 0;
}

function saveDB() {
  localStorage.setItem('financeDB', JSON.stringify(db));
  updateIncomeFunds();
  updateBalance();
  renderCalendar();
  renderDebts();
  renderChart();
  populateMonthSelect();
  updateIncomeSelect();
}

function updateIncomeFunds() {
  const incomeFundsMap = new Map();
  db.incomeFunds.forEach(f => incomeFundsMap.set(f.id, f));

  db.movements.forEach(m => {
    if (m.type === 'ingreso' && !incomeFundsMap.has(m.id)) {
      incomeFundsMap.set(m.id, { id: m.id, title: m.title, originalAmount: m.amount, remaining: m.amount });
    }
  });

  const incomeIdsFromMovements = new Set(db.movements.filter(m => m.type === 'ingreso').map(m => m.id));
  for (let id of incomeFundsMap.keys()) {
    if (!incomeIdsFromMovements.has(id) && !db.movements.some(m => m.incomeSourceId === id)) {
      incomeFundsMap.delete(id);
    }
  }

  db.incomeFunds = Array.from(incomeFundsMap.values());
}

function updateBalance() {
  let total = 0;
  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalMeDeben = 0;
  let totalDebo = 0;
  
  db.movements.forEach(m => {
    if (m.type === 'ingreso') {
      totalIngresos += m.amount;
      total += m.amount;
    } else {
      totalEgresos += m.amount;
      total -= m.amount;
    }
  });
  
  db.debts.forEach(d => {
    if (d.type === 'meDeben') {
      totalMeDeben += d.remaining;
    } else {
      totalDebo += d.remaining;
    }
  });
  
  const balanceElement = document.getElementById('balance');
  balanceElement.innerHTML = `$${formatNumber(total)}`;
}

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
    
    // Obtener todos los fondos disponibles con saldo > 0
    let availableFunds = db.incomeFunds.filter(f => f.remaining > 0);
    
    if (incomeSourceSelect.value) {
        // Si seleccionó uno específico, ponerlo al inicio de la lista
        const selectedId = parseInt(incomeSourceSelect.value);
        const selectedFund = db.incomeFunds.find(f => f.id === selectedId);
        if (selectedFund && selectedFund.remaining > 0) {
            availableFunds = [selectedFund, ...availableFunds.filter(f => f.id !== selectedId)];
        }
    } else {
        // Si no seleccionó, ordenar por mayor saldo (ya están en availableFunds)
        availableFunds.sort((a, b) => b.remaining - a.remaining);
    }
    
    // Distribuir el gasto entre los fondos disponibles
    for (let fund of availableFunds) {
        if (remainingAmount <= 0) break;
        
        const takeFromThis = Math.min(fund.remaining, remainingAmount);
        fund.remaining -= takeFromThis;
        remainingAmount -= takeFromThis;
        fundsUsed.push({ id: fund.id, amount: takeFromThis });
        
        // El primer fondo usado será el principal (para referencia)
        if (!primaryFund) primaryFund = fund;
    }
    
    // Si aún queda monto por cubrir (no hay suficientes fondos)
    if (remainingAmount > 0) {
        if (confirm(`No hay suficiente saldo en tus ingresos para cubrir $${formatNumber(remainingAmount)} restante.\n¿Deseas registrar el egreso de todas formas? (Se marcará como sobregiro)`)) {
            // Registrar el movimiento sin asociar la parte no cubierta
            movement.incomeSourceId = primaryFund ? primaryFund.id : null;
            movement.overspend = remainingAmount; // Opcional: marcar cuanto es sobregiro
        } else {
            return; // Cancelar el movimiento
        }
    } else {
        // Si se usaron fondos, asignar el ID del fondo principal para referencia
        if (primaryFund) {
            movement.incomeSourceId = primaryFund.id;
            movement.fundsUsed = fundsUsed; // Guardar el detalle (opcional)
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
  incomeSourceSelect.value = '';
  
  showDayMovements(movDate.value);
}

function toggleIncomeSelect() {
  const type = document.getElementById('movType').value;
  const incomeSelect = document.getElementById('incomeSourceSelect');
  incomeSelect.style.display = type === 'egreso' ? 'block' : 'none';
  if (type === 'egreso') updateIncomeSelect();
}

function updateIncomeSelect() {
  const select = document.getElementById('incomeSourceSelect');
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

function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  document.getElementById('monthLabel').innerText = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const calendarGrid = document.getElementById('calendarGrid');
  calendarGrid.innerHTML = '';
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  for (let i = 0; i < firstDay; i++) calendarGrid.innerHTML += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasMov = db.movements.some(m => m.date === date);
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

function showDayMovements(date) {
  const dayMovements = document.getElementById('dayMovements');
  const movementsTitle = document.getElementById('movementsTitle');
  const dayMovs = db.movements.filter(m => m.date === date);
  movementsTitle.innerText = `Movimientos del ${formatDate(date)}`;
  if (dayMovs.length === 0) {
    dayMovements.innerHTML = '<p>No hay movimientos para este día</p>';
    return;
  }
  let html = '';
  dayMovs.forEach(mov => {
    let sourceText = '';
    if (mov.incomeSourceId) {
      const fund = db.incomeFunds.find(f => f.id === mov.incomeSourceId);
      if (fund) sourceText = `<br><small>Sale de: ${fund.title}</small>`;
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
      </div>
    `;
  });
  html += `<button class="secondary" onclick="openModal('${date}')">Ver/Editar todos</button>`;
  dayMovements.innerHTML = html;
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

function renderChart() {
  const monthSelect = document.getElementById('chartMonthSelect');
  const selectedMonth = monthSelect.value;
  let filteredMovements = db.movements.filter(m => m.type === 'egreso');
  if (selectedMonth) filteredMovements = filteredMovements.filter(m => m.date.slice(0, 7) === selectedMonth);
  const data = {};
  filteredMovements.forEach(m => data[m.title] = (data[m.title] || 0) + m.amount);
  if (chart) chart.destroy();
  const ctx = document.getElementById('expensesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#10b981']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (context) => '$' + formatNumber(context.raw) } }
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

function exportTXT() {
  let txt = 'dia;titulo;descripcion;monto;tipo\n';
  db.movements.forEach(m => {
    const [year, month, day] = m.date.split('-');
    txt += `${day}/${month}/${year};${m.title};${m.desc || ''};${formatNumber(m.amount)};${m.type}\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'finanzas.txt';
  a.click();
}

function importTXT() { document.getElementById('fileInput').click(); }

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const lines = content.split('\n');
      const importedMovements = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [date, title, desc, amountStr, type] = line.split(';');
        if (!date || !title || !amountStr || !type) continue;
        const [day, month, year] = date.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const amount = parseColombianNumber(amountStr);
        importedMovements.push({
          id: Date.now() + i,
          date: formattedDate,
          type: type.toLowerCase(),
          title: title.trim(),
          desc: desc ? desc.trim() : '',
          amount: amount
        });
      }
      if (importedMovements.length > 0) {
        if (db.movements.length === 0) db.movements = importedMovements;
        else {
          const action = confirm(`Se importarán ${importedMovements.length} movimientos.\nAceptar: Añadir\nCancelar: Reemplazar`);
          if (action) db.movements.push(...importedMovements);
          else db.movements = importedMovements;
        }
        saveDB();
        alert(`Importación exitosa: ${importedMovements.length} movimientos`);
        input.value = '';
      } else alert('No se encontraron movimientos');
    } catch (error) {
      console.error(error);
      alert('Error al importar. Verifica el formato.');
    }
  };
  reader.readAsText(file);
}

function addDebt() {
  const amount = parseColombianNumber(document.getElementById('debtAmount').value);
  const d = {
    id: Date.now(),
    type: document.getElementById('debtType').value,
    person: document.getElementById('debtPerson').value,
    title: document.getElementById('debtTitle').value,
    desc: document.getElementById('debtDesc').value,
    amount: amount,
    date: document.getElementById('debtDate').value,
    remaining: amount
  };
  db.debts.push(d);
  db.movements.push({
    id: Date.now(),
    date: d.date,
    type: d.type === 'meDeben' ? 'egreso' : 'ingreso',
    title: 'Préstamo ' + d.title,
    desc: d.desc,
    amount: amount
  });
  saveDB();
  document.getElementById('debtPerson').value = '';
  document.getElementById('debtTitle').value = '';
  document.getElementById('debtDesc').value = '';
  document.getElementById('debtAmount').value = '';
  document.getElementById('debtDate').value = '';
}

function renderDebts() {
  const debtList = document.getElementById('debtList');
  debtList.innerHTML = '';
  if (db.debts.length === 0) {
    debtList.innerHTML = '<p>No hay deudas registradas</p>';
    return;
  }
  const debtsMeDeben = db.debts.filter(d => d.type === 'meDeben');
  const debtsDebo = db.debts.filter(d => d.type === 'debo');
  if (debtsMeDeben.length > 0) {
    debtList.innerHTML += '<h4>Me deben:</h4>';
    debtsMeDeben.forEach(d => renderDebtItem(d, db.debts.indexOf(d)));
  }
  if (debtsDebo.length > 0) {
    debtList.innerHTML += debtsMeDeben.length > 0 ? '<br><h4>Debo:</h4>' : '<h4>Debo:</h4>';
    debtsDebo.forEach(d => renderDebtItem(d, db.debts.indexOf(d)));
  }
}

function renderDebtItem(d, originalIndex) {
  const [year, month, day] = d.date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const debtList = document.getElementById('debtList');
  debtList.innerHTML += `
    <div class="card debt-item" data-index="${originalIndex}" data-type="${d.type}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <b>${d.title}</b>
        <div>
          <button class="secondary" onclick="payFullDebt(${originalIndex})" style="margin-right: 0.5rem;">Pagar todo</button>
          <button class="danger" onclick="deleteDebt(${originalIndex})">🗑️</button>
        </div>
      </div>
      <p><strong>Persona:</strong> ${d.person}</p>
      <p><strong>Descripción:</strong> ${d.desc}</p>
      <p><strong>Fecha:</strong> ${dateFormatted}</p>
      <p><strong>Total:</strong> $${formatNumber(d.amount)}</p>
      <p><strong>Restante:</strong> $${formatNumber(d.remaining)}</p>
      <div class="debt-progress" style="margin: 0.5rem 0; background: #1e293b; border-radius: 4px; overflow: hidden;">
        <div style="width: ${((d.amount - d.remaining) / d.amount * 100)}%; background: ${d.type === 'meDeben' ? '#3b82f6' : '#ef4444'}; height: 8px; border-radius: 4px;"></div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
        <input type="text" id="p${originalIndex}" placeholder="Abono" style="flex: 1; padding: 0.4rem; border-radius: 4px; border: none; background: #1e293b; color: #e5e7eb;" inputmode="decimal" oninput="formatInputNumber(event)" />
        <button class="primary" onclick="payDebt(${originalIndex})" style="width: 50%; padding: 0.5rem; font-size: 0.9rem;">Abonar</button>
      </div>
    </div>
  `;
}

function payFullDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  if (confirm(`¿Pagar toda la deuda "${d.title}" por $${formatNumber(d.remaining)}?`)) payDebt(index, d.remaining);
}

function deleteDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  if (confirm(`¿Eliminar la deuda "${d.title}"?`)) {
    if (d.remaining > 0 && confirm(`Saldo pendiente de $${formatNumber(d.remaining)}. ¿Registrar como movimiento?`)) {
      db.movements.push({
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        type: d.type === 'meDeben' ? 'egreso' : 'ingreso',
        title: `Cancelación: ${d.title}`,
        desc: `Deuda cancelada con ${d.person}`,
        amount: d.remaining
      });
    }
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
    const inputElement = document.getElementById('p' + index);
    if (!inputElement || !inputElement.value) { alert('Ingresa un monto'); return; }
    amount = parseColombianNumber(inputElement.value);
  }
  if (amount <= 0 || amount > d.remaining) { alert('Monto inválido'); return; }
  d.remaining -= amount;
  db.movements.push({
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    type: d.type === 'meDeben' ? 'ingreso' : 'egreso',
    title: `Abono ${d.type === 'meDeben' ? 'cobro' : 'pago'}: ${d.title}`,
    desc: `Abono a ${d.person}`,
    amount: amount
  });
  if (d.remaining <= 0) { alert(`Deuda "${d.title}" pagada!`); db.debts.splice(index, 1); }
  saveDB();
  const inputElement = document.getElementById('p' + index);
  if (inputElement) inputElement.value = '';
}

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
      </div>
    `;
  });
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
  selectDay(mov.date);
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
      const fundIndex = db.incomeFunds.findIndex(f => f.id === mov.id);
      if (fundIndex !== -1) db.incomeFunds.splice(fundIndex, 1);
    }
    db.movements.splice(index, 1);
    saveDB();
    if (selectedDay) showDayMovements(selectedDay);
  }
}

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
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${mov.title}</strong>
              <div>${mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}: $${formatNumber(mov.amount)}</div>
              <div><small>${day}/${month}/${year}</small></div>
              ${mov.desc ? `<small>${mov.desc}</small>` : ''}
              ${sourceText}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="secondary" onclick="editMovement(${mov.id}); closeModal()">Editar</button>
              <button class="danger" onclick="deleteMovement(${mov.id}); closeModal()">Eliminar</button>
            </div>
          </div>
        </div>
      `;
    });
  }
  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('movementModal').style.display = 'none';
}

function showIncomeDetails() {
  const modal = document.getElementById('incomeDetailModal');
  const detailList = document.getElementById('incomeDetailList');
  
  if (db.incomeFunds.length === 0) {
    detailList.innerHTML = '<p>No hay ingresos registrados</p>';
  } else {
    detailList.innerHTML = '';
    
    // Separar activos (con saldo) e inactivos (agotados)
    const activeFunds = db.incomeFunds.filter(f => f.remaining > 0);
    const emptyFunds = db.incomeFunds.filter(f => f.remaining <= 0);
    
    // Mostrar ingresos activos primero (con saldo disponible)
    if (activeFunds.length > 0) {
      activeFunds.forEach(fund => {
        const percentage = ((fund.remaining / fund.originalAmount) * 100).toFixed(1);
        detailList.innerHTML += `
          <div class="income-detail-item" style="border-left: 4px solid #22c55e; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
              <strong>${fund.title}</strong>
              <span style="color: #22c55e;">$${formatNumber(fund.remaining)} / $${formatNumber(fund.originalAmount)}</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 0.3rem;">
              <small style="color: #22c55e;">${percentage}% disponible</small>
              <small>$${formatNumber(fund.originalAmount - fund.remaining)} gastado</small>
            </div>
          </div>
        `;
      });
    }
    
    // Mostrar ingresos agotados si existen 
    if (emptyFunds.length > 0) {
      if (activeFunds.length > 0) {
        detailList.innerHTML += '<hr style="border-color: #334155; margin: 1rem 0;">';
        detailList.innerHTML += '<p style="color: #94a3b8; margin-bottom: 0.5rem;"><small>📁 Ingresos agotados:</small></p>';
      }
      
      emptyFunds.forEach(fund => {
        detailList.innerHTML += `
          <div class="income-detail-item" style="opacity: 0.6; border-left: 4px solid #64748b; margin-bottom: 0.3rem;">
            <div style="display: flex; justify-content: space-between;">
              <strong>${fund.title}</strong>
              <span style="color: #94a3b8;">$0 / $${formatNumber(fund.originalAmount)}</span>
            </div>
            <small style="color: #94a3b8;">Completamente gastado</small>
          </div>
        `;
      });
    }
  }
  modal.style.display = 'flex';
}

function closeIncomeModal() {
  document.getElementById('incomeDetailModal').style.display = 'none';
}

function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (id === 'calendar') {
    renderCalendar();
    toggleIncomeSelect();
  }
  setTimeout(initAutoFormat, 10);
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
  const amountInputs = document.querySelectorAll('input[inputmode="decimal"]');
  amountInputs.forEach(input => {
    input.removeEventListener('input', formatInputNumber);
    input.addEventListener('input', formatInputNumber);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  updateIncomeFunds();
  updateBalance();
  renderCalendar();
  renderDebts();
  renderChart();
  populateMonthSelect();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  document.getElementById('movDate').value = todayStr;
  document.getElementById('debtDate').value = todayStr;
  initAutoFormat();
  toggleIncomeSelect();
  document.getElementById('movementModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  document.getElementById('incomeDetailModal').addEventListener('click', function(e) {
    if (e.target === this) closeIncomeModal();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Finanzas_basicas/sw.js');
  }
});