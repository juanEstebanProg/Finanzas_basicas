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
  
  // Si ya existe el resumen detallado, actualízalo, sino, créalo
  let summaryHtml = `
    <div class="card">
      <h3>Resumen detallado</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0;">
        <div style="background: #166534; padding: 0.5rem; border-radius: 6px;">
          <small>Ingresos</small>
          <div style="font-weight: bold; color: #bbf7d0;">+$${formatNumber(totalIngresos)}</div>
        </div>
        <div style="background: #991b1b; padding: 0.5rem; border-radius: 6px;">
          <small>Egresos</small>
          <div style="font-weight: bold; color: #fecaca;">-$${formatNumber(totalEgresos)}</div>
        </div>
        <div style="background: #1e40af; padding: 0.5rem; border-radius: 6px;">
          <small>Me deben</small>
          <div style="font-weight: bold; color: #93c5fd;">$${formatNumber(totalMeDeben)}</div>
        </div>
        <div style="background: #7c2d12; padding: 0.5rem; border-radius: 6px;">
          <small>Debo</small>
          <div style="font-weight: bold; color: #fdba74;">$${formatNumber(totalDebo)}</div>
        </div>
      </div>
      <div style="border-top: 1px solid #334155; margin-top: 0.5rem; padding-top: 0.5rem;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Balance total:</span>
          <span style="color: ${total >= 0 ? '#22c55e' : '#ef4444'}">$${formatNumber(total)}</span>
        </div>
      </div>
    </div>
  `;
  
  // Actualizar balance principal
  balanceElement.innerHTML = `$${formatNumber(total)}`;
  
  // Añadir o actualizar el resumen detallado
  const homeView = document.getElementById('home');
  const existingSummary = document.querySelector('#home .card:nth-child(2)');
  
  if (existingSummary && existingSummary.querySelector('h3').textContent === 'Resumen detallado') {
    existingSummary.outerHTML = summaryHtml;
  } else {
    // Insertar después del primer card (balance total)
    const firstCard = homeView.querySelector('.card');
    firstCard.insertAdjacentHTML('afterend', summaryHtml);
  }
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

function importTXT() {
  document.getElementById('fileInput').click();
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const lines = content.split('\n');
      
      // Saltar la primera línea (encabezados)
      const importedMovements = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [date, title, desc, amountStr, type] = line.split(';');
        
        if (!date || !title || !amountStr || !type) continue;
        
        // Convertir fecha de DD/MM/YYYY a YYYY-MM-DD
        const [day, month, year] = date.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        // Parsear monto (remover puntos de miles y reemplazar coma decimal)
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
        // Si la base de datos está vacía, reemplazar todo
        if (db.movements.length === 0) {
          db.movements = importedMovements;
        } else {
          // Preguntar al usuario qué quiere hacer
          const action = confirm(
            `Se van a importar ${importedMovements.length} movimientos.\n` +
            '¿Quieres:\n' +
            '• Aceptar: Añadir a los existentes\n' +
            '• Cancelar: Reemplazar todos los movimientos'
          );
          
          if (action) {
            // Añadir a los existentes
            db.movements.push(...importedMovements);
          } else {
            // Reemplazar todo
            db.movements = importedMovements;
          }
        }
        
        saveDB();
        alert(`Importación exitosa: ${importedMovements.length} movimientos importados`);
        
        // Limpiar el input de archivo
        input.value = '';
      } else {
        alert('No se encontraron movimientos para importar');
      }
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error al importar el archivo. Verifica el formato.');
    }
  };
  
  reader.readAsText(file);
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
  
  // Separar deudas en "Me deben" y "Debo"
  const debtsMeDeben = db.debts.filter(d => d.type === 'meDeben');
  const debtsDebo = db.debts.filter(d => d.type === 'debo');
  
  if (debtsMeDeben.length > 0) {
    debtList.innerHTML += '<h4>Me deben:</h4>';
    debtsMeDeben.forEach((d, i) => {
      renderDebtItem(d, i, db.debts.indexOf(d));
    });
  }
  
  if (debtsDebo.length > 0) {
    debtList.innerHTML += debtsMeDeben.length > 0 ? '<br><h4>Debo:</h4>' : '<h4>Debo:</h4>';
    debtsDebo.forEach((d, i) => {
      const originalIndex = db.debts.indexOf(d);
      renderDebtItem(d, i + debtsMeDeben.length, originalIndex);
    });
  }
}

function renderDebtItem(d, inputIndex, originalIndex) {
  const [year, month, day] = d.date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  
  const debtList = document.getElementById('debtList');
  
  debtList.innerHTML += `
    <div class="card debt-item" data-index="${originalIndex}" data-type="${d.type}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <b>${d.title}</b>
        <div>
          <button class="secondary" onclick="payFullDebt(${originalIndex})" style="margin-right: 0.5rem;">
            Pagar todo
          </button>
          <button class="danger" onclick="deleteDebt(${originalIndex})">
            🗑️
          </button>
        </div>
      </div>
      <p><strong>Persona:</strong> ${d.person}</p>
      <p><strong>Descripción:</strong> ${d.desc}</p>
      <p><strong>Fecha:</strong> ${dateFormatted}</p>
      <p><strong>Total:</strong> $${formatNumber(d.amount)}</p>
      <p><strong>Restante:</strong> $${formatNumber(d.remaining)}</p>
      
      <div class="debt-progress" style="margin: 0.5rem 0; background: #1e293b; border-radius: 4px; overflow: hidden;">
        <div style="width: ${((d.amount - d.remaining) / d.amount * 100)}%; 
                    background: ${d.type === 'meDeben' ? '#3b82f6' : '#ef4444'}; 
                    height: 8px; border-radius: 4px;"></div>
      </div>
      
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
        <input type="text" 
               id="p${inputIndex}" 
               placeholder="Abono" 
               style="flex: 1; padding: 0.4rem; border-radius: 4px; border: none; background: #1e293b; color: #e5e7eb;"
               inputmode="decimal" 
               oninput="formatInputNumber(event)" />
        <button class="primary" onclick="payDebt(${originalIndex}, ${inputIndex})" style="width: 50%; padding: 0.5rem; font-size: 0.9rem;">
          Abonar
        </button>
      </div>
    </div>
  `;
}

function payFullDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  
  if (confirm(`¿Pagar toda la deuda "${d.title}" por $${formatNumber(d.remaining)}?`)) {
    payDebt(index, null, d.remaining);
  }
}

function deleteDebt(index) {
  const d = db.debts[index];
  if (!d) return;
  
  if (confirm(`¿Estás seguro de eliminar la deuda "${d.title}"?\n\nEsta acción no se puede deshacer.`)) {
    // Si queda saldo pendiente, preguntar si quiere registrar como movimiento
    if (d.remaining > 0) {
      const registerMovement = confirm(
        `Queda un saldo pendiente de $${formatNumber(d.remaining)}.\n` +
        '¿Deseas registrar este saldo como un movimiento?'
      );
      
      if (registerMovement) {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        
        db.movements.push({
          id: Date.now(),
          date: todayStr,
          type: d.type === 'meDeben' ? 'egreso' : 'ingreso',
          title: `Cancelación: ${d.title}`,
          desc: `Deuda cancelada con ${d.person}`,
          amount: d.remaining
        });
      }
    }
    
    db.debts.splice(index, 1);
    saveDB();
  }
}

function payDebt(index, inputIndex = null, specificAmount = null) {
  const d = db.debts[index];
  if (!d) return;
  
  let amount;
  
  if (specificAmount !== null) {
    amount = specificAmount;
  } else {
    const inputElement = document.getElementById('p' + inputIndex);
    if (!inputElement || !inputElement.value) {
      alert('Ingresa un monto para abonar');
      return;
    }
    amount = parseColombianNumber(inputElement.value);
  }
  
  if (amount <= 0) {
    alert('Ingresa un monto válido mayor a cero');
    return;
  }
  
  if (amount > d.remaining) {
    alert(`No puedes abonar más de lo que falta ($${formatNumber(d.remaining)})`);
    return;
  }
  
  d.remaining -= amount;
  
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  db.movements.push({
    id: Date.now(),
    date: todayStr,
    type: d.type === 'meDeben' ? 'ingreso' : 'egreso',
    title: `Abono ${d.type === 'meDeben' ? 'cobro' : 'pago'}: ${d.title}`,
    desc: `Abono a ${d.person}`,
    amount: amount
  });
  
  if (d.remaining <= 0) {
    alert(`¡Deuda "${d.title}" completamente pagada!`);
    db.debts.splice(index, 1);
  }
  
  saveDB();
  
  // Limpiar el input si existe
  if (inputIndex !== null) {
    const inputElement = document.getElementById('p' + inputIndex);
    if (inputElement) inputElement.value = '';
  }
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
  
  // Inicializar formateo automático después de cambiar de vista
  setTimeout(initAutoFormat, 10);
}

// Función para formatear número mientras se escribe
function formatInputNumber(event) {
  const input = event.target;
  let value = input.value.replace(/\./g, '');
  
  // Permitir números, comas decimales y borrar
  if (!/^[\d,]*$/.test(value) && value !== '') {
    // Remover caracteres no válidos
    value = value.replace(/[^\d,]/g, '');
  }
  
  // Manejar coma decimal (solo una)
  const parts = value.split(',');
  if (parts.length > 2) {
    value = parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Separar parte entera y decimal
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? ',' + parts[1].slice(0, 2) : '';
  
  // Agregar puntos de miles
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  input.value = integerPart + decimalPart;
}

// Función para inicializar el formateo automático
function initAutoFormat() {
  const amountInputs = document.querySelectorAll('input[inputmode="decimal"]');
  
  amountInputs.forEach(input => {
    // Remover event listeners existentes para evitar duplicados
    input.removeEventListener('input', formatInputNumber);
    // Añadir nuevo event listener
    input.addEventListener('input', formatInputNumber);
  });
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar funciones existentes
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
  
  // Inicializar formateo automático
  initAutoFormat();
  
  // Cerrar modal al hacer clic fuera
  document.getElementById('movementModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
  
  // Instalar service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Finanzas_basicas/sw.js');
  }
});