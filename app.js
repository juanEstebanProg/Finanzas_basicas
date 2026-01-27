const db = JSON.parse(localStorage.getItem('financeDB')) || {
  movements: [],
  debts: []
};

let currentDate = new Date();
let chart;
let chartType = 'pie'; // 'pie' o 'bar'
let selectedDay = null;

function saveDB() {
  localStorage.setItem('financeDB', JSON.stringify(db));
  updateBalance();
  renderCalendar();
  renderDebts();
  renderChart();
  populateMonthSelect();
}

function updateBalance() {
  let total = 0;
  db.movements.forEach(m => {
    total += m.type === 'ingreso' ? m.amount : -m.amount;
  });
  document.getElementById('balance').innerText = `$${total}`;
}

function addMovement() {
  const movDate = document.getElementById('movDate');
  const movType = document.getElementById('movType');
  const movTitle = document.getElementById('movTitle');
  const movDesc = document.getElementById('movDesc');
  const movAmount = document.getElementById('movAmount');
  
  if (!movDate.value || !movTitle.value || !movAmount.value) {
    alert('Por favor completa los campos requeridos');
    return;
  }
  
  const movement = {
    id: Date.now(),
    date: movDate.value,
    type: movType.value,
    title: movTitle.value,
    desc: movDesc.value,
    amount: Number(movAmount.value)
  };
  
  db.movements.push(movement);
  saveDB();
  
  // Limpiar campos
  movTitle.value = '';
  movDesc.value = '';
  movAmount.value = '';
  
  // Mostrar movimientos del día
  showDayMovements(movDate.value);
}

function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  document.getElementById('monthLabel').innerText = currentDate.toLocaleDateString('es', {
    month: 'long',
    year: 'numeric'
  });

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

    calendarGrid.innerHTML += `
      <div class="${dayClass}"
           onclick="selectDay('${date}')">${d}</div>
    `;
  }
  
  // Si hay un día seleccionado, mostrar sus movimientos
  if (selectedDay) {
    showDayMovements(selectedDay);
  }
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
    html += `
      <div class="movement-item">
        <div>
          <strong>${mov.title}</strong>
          <div>${mov.type === 'ingreso' ? '➕' : '➖'} $${mov.amount}</div>
          ${mov.desc ? `<small>${mov.desc}</small>` : ''}
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('es', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
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
  
  if (selectedMonth) {
    filteredMovements = filteredMovements.filter(m => m.date.startsWith(selectedMonth));
  }
  
  const data = {};
  filteredMovements.forEach(m => {
    data[m.title] = (data[m.title] || 0) + m.amount;
  });

  if (chart) chart.destroy();

  const ctx = document.getElementById('expensesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: chartType,
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [
          '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
          '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#10b981'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
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
  
  db.movements.forEach(m => {
    if (m.type === 'egreso') {
      months.add(m.date.slice(0, 7)); // YYYY-MM
    }
  });
  
  // Limpiar opciones excepto la primera
  while (monthSelect.options.length > 1) {
    monthSelect.remove(1);
  }
  
  // Ordenar meses de más reciente a más antiguo
  const sortedMonths = Array.from(months).sort().reverse();
  
  sortedMonths.forEach(month => {
    const date = new Date(month + '-01');
    const option = document.createElement('option');
    option.value = month;
    option.text = date.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    monthSelect.appendChild(option);
  });
}

function exportTXT() {
  let txt = 'dia;titulo;descripcion;monto;tipo\n';
  db.movements.forEach(m => {
    txt += `${m.date};${m.title};${m.desc || ''};${m.amount};${m.type}\n`;
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'finanzas.txt';
  a.click();
}

function addDebt() {
  const d = {
    id: Date.now(),
    type: document.getElementById('debtType').value,
    person: document.getElementById('debtPerson').value,
    title: document.getElementById('debtTitle').value,
    desc: document.getElementById('debtDesc').value,
    amount: Number(document.getElementById('debtAmount').value),
    date: document.getElementById('debtDate').value,
    remaining: Number(document.getElementById('debtAmount').value)
  };

  db.debts.push(d);

  db.movements.push({
    id: Date.now(),
    date: d.date,
    type: d.type === 'meDeben' ? 'egreso' : 'ingreso',
    title: 'Préstamo ' + d.title,
    desc: d.desc,
    amount: d.amount
  });

  saveDB();
  
  // Limpiar campos de deuda
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
  
  db.debts.forEach((d, i) => {
    debtList.innerHTML += `
      <div class="card">
        <b>${d.title}</b> (${d.person})
        <p>${d.desc}</p>
        <p>Total: $${d.amount} | Restante: $${d.remaining}</p>
        <div style="display: flex; gap: 0.5rem;">
          <input type="number" id="p${i}" placeholder="Abono" style="flex: 1;" />
          <button class="primary" onclick="payDebt(${i})">Abonar</button>
        </div>
      </div>
    `;
  });
}

function payDebt(i) {
  const value = Number(document.getElementById('p' + i).value);
  const d = db.debts[i];

  if (!value || value <= 0) {
    alert('Ingresa un monto válido');
    return;
  }

  d.remaining -= value;

  db.movements.push({
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    type: d.type === 'meDeben' ? 'ingreso' : 'egreso',
    title: 'Abono ' + d.title,
    desc: '',
    amount: value
  });

  if (d.remaining <= 0) {
    db.debts.splice(i, 1);
  }
  
  saveDB();
}

function renderFiltered() {
  const filterResults = document.getElementById('filterResults');
  const filterTitle = document.getElementById('filterTitle');
  const filterAmount = document.getElementById('filterAmount');
  
  filterResults.innerHTML = '';
  
  const filtered = db.movements
    .filter(m =>
      m.title.toLowerCase().includes(filterTitle.value.toLowerCase()) &&
      m.amount >= Number(filterAmount.value || 0)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (filtered.length === 0) {
    filterResults.innerHTML = '<p>No se encontraron movimientos</p>';
    return;
  }
  
  filtered.forEach(m => {
    filterResults.innerHTML += `
      <div class="movement-item">
        <div>
          <strong>${m.date}</strong>
          <div>${m.title} - ${m.type === 'ingreso' ? '➕' : '➖'} $${m.amount}</div>
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
  
  // Llenar formulario con datos del movimiento
  document.getElementById('movDate').value = mov.date;
  document.getElementById('movType').value = mov.type;
  document.getElementById('movTitle').value = mov.title;
  document.getElementById('movDesc').value = mov.desc;
  document.getElementById('movAmount').value = mov.amount;
  
  // Remover el movimiento para editar
  deleteMovement(id, false);
  
  // Ir a la vista de calendario
  showView('calendar', document.querySelector('nav button:nth-child(2)'));
  
  // Seleccionar el día
  selectDay(mov.date);
}

function deleteMovement(id, confirm = true) {
  if (confirm && !window.confirm('¿Estás seguro de eliminar este movimiento?')) {
    return;
  }
  
  const index = db.movements.findIndex(m => m.id === id);
  if (index !== -1) {
    db.movements.splice(index, 1);
    saveDB();
    
    if (selectedDay) {
      showDayMovements(selectedDay);
    }
  }
}

function openModal(date) {
  const modal = document.getElementById('movementModal');
  const modalList = document.getElementById('modalMovementsList');
  
  const dayMovs = db.movements.filter(m => m.date === date);
  
  if (dayMovs.length === 0) {
    modalList.innerHTML = '<p>No hay movimientos para este día</p>';
  } else {
    modalList.innerHTML = '';
    dayMovs.forEach(mov => {
      modalList.innerHTML += `
        <div class="modal-movement-item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${mov.title}</strong>
              <div>${mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}: $${mov.amount}</div>
              ${mov.desc ? `<small>${mov.desc}</small>` : ''}
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

function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Si vamos al calendario, renderizar con el día seleccionado
  if (id === 'calendar') {
    renderCalendar();
  }
}

// Inicializar
updateBalance();
renderCalendar();
renderDebts();
renderChart();
populateMonthSelect();

// Establecer fecha actual en formulario por defecto
document.getElementById('movDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('debtDate').value = new Date().toISOString().slice(0, 10);
