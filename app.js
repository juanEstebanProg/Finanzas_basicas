const db = JSON.parse(localStorage.getItem('financeDB')) || {
  movements: [],
  debts: []
};

let currentDate = new Date();
let chart;
let chartType = 'pie'; // 'pie' o 'bar'
let selectedDay = null;

// Función para formatear números al estilo colombiano
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

// Función para convertir string con formato colombiano a número
function parseColombianNumber(str) {
  if (!str) return 0;
  // Remover puntos de separación de miles y reemplazar coma decimal por punto
  const cleanStr = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanStr) || 0;
}

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
  document.getElementById('balance').innerText = `$${formatNumber(total)}`;
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
  
  // Parsear el monto con formato colombiano
  const amount = parseColombianNumber(movAmount.value);
  
  const movement = {
    id: Date.now(),
    date: movDate.value,
    type: movType.value,
    title: movTitle.value,
    desc: movDesc.value,
    amount: amount
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

  document.getElementById('monthLabel').innerText = currentDate.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric'
  });

  const calendarGrid = document.getElementById('calendarGrid');
  calendarGrid.innerHTML = '';

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  
  // Obtener fecha actual en Colombia
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
          <div>${mov.type === 'ingreso' ? '➕' : '➖'} $${formatNumber(mov.amount)}</div>
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
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString('es-CO', {
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
    filteredMovements = filteredMovements.filter(m => {
      const movMonth = m.date.slice(0, 7);
      return movMonth === selectedMonth;
    });
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
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              label += '$' + formatNumber(context.raw);
              return label;
            }
          }
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
      const monthStr = m.date.slice(0, 7);
      months.add(monthStr);
    }
  });
  
  while (monthSelect.options.length > 1) {
    monthSelect.remove(1);
  }
  
  const sortedMonths = Array.from(months).sort().reverse();
  
  sortedMonths.forEach(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(year, monthNum - 1, 1);
    
    const option = document.createElement('option');
    option.value = month;
    option.text = date.toLocaleDateString('es-CO', { 
      month: 'long', 
      year: 'numeric'
    });
    monthSelect.appendChild(option);
  });
}

function exportTXT() {
  let txt = 'dia;titulo;descripcion;monto;tipo\n';
  db.movements.forEach(m => {
    const [year, month, day] = m.date.split('-');
    const dateFormatted = `${day}/${month}/${year}`;
    txt += `${dateFormatted};${m.title};${m.desc || ''};${formatNumber(m.amount)};${m.type}\n`;
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'finanzas.txt';
  a.click();
}

function addDebt() {
  // Parsear el monto con formato colombiano
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
    const [year, month, day] = d.date.split('-');
    const dateFormatted = `${day}/${month}/${year}`;
    
    debtList.innerHTML += `
      <div class="card">
        <b>${d.title}</b> (${d.person})
        <p>${d.desc}</p>
        <p>Fecha: ${dateFormatted}</p>
        <p>Total: $${formatNumber(d.amount)} | Restante: $${formatNumber(d.remaining)}</p>
        <div style="display: flex; gap: 0.5rem; align-items: center; width: 100px; height: 32px;">
          <input type="number" id="p${i}" placeholder="Abono" style="flex: 1; width: 100px; height: 32px;" />
          <button class="primary" onclick="payDebt(${i})">Abonar</button>
        </div>
      </div>
    `;
  });
}

function payDebt(i) {
  const valueInput = document.getElementById('p' + i).value;
  const value = parseColombianNumber(valueInput);
  const d = db.debts[i];

  if (!value || value <= 0) {
    alert('Ingresa un monto válido');
    return;
  }

  d.remaining -= value;

  // Usar fecha actual
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  db.movements.push({
    id: Date.now(),
    date: todayStr,
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
  const filterAmountInput = document.getElementById('filterAmount');
  
  // Parsear el monto mínimo con formato colombiano
  const minAmount = parseColombianNumber(filterAmountInput.value);
  
  filterResults.innerHTML = '';
  
  const filtered = db.movements
    .filter(m =>
      m.title.toLowerCase().includes(filterTitle.value.toLowerCase()) &&
      m.amount >= minAmount
    )
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });
  
  if (filtered.length === 0) {
    filterResults.innerHTML = '<p>No se encontraron movimientos</p>';
    return;
  }
  
  filtered.forEach(m => {
    const [year, month, day] = m.date.split('-');
    const dateFormatted = `${day}/${month}/${year}`;
    
    filterResults.innerHTML += `
      <div class="movement-item">
        <div>
          <strong>${dateFormatted}</strong>
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
  
  // Llenar formulario con datos del movimiento
  document.getElementById('movDate').value = mov.date;
  document.getElementById('movType').value = mov.type;
  document.getElementById('movTitle').value = mov.title;
  document.getElementById('movDesc').value = mov.desc;
  // Formatear el monto para mostrarlo
  document.getElementById('movAmount').value = formatNumber(mov.amount);
  
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
  const modalTitle = document.getElementById('modalTitle');
  
  const dayMovs = db.movements.filter(m => m.date === date);
  
  modalTitle.innerText = `Movimientos del ${formatDate(date)}`;
  
  if (dayMovs.length === 0) {
    modalList.innerHTML = '<p>No hay movimientos para este día</p>';
  } else {
    modalList.innerHTML = '';
    dayMovs.forEach(mov => {
      const [year, month, day] = mov.date.split('-');
      const dateFormatted = `${day}/${month}/${year}`;
      
      modalList.innerHTML += `
        <div class="modal-movement-item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${mov.title}</strong>
              <div>${mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}: $${formatNumber(mov.amount)}</div>
              <div><small>${dateFormatted}</small></div>
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
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
document.getElementById('movDate').value = todayStr;
document.getElementById('debtDate').value = todayStr;

// Cerrar modal al hacer clic fuera
document.getElementById('movementModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeModal();
  }
});
//instalar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/Finanzas_basicas/sw.js');
}