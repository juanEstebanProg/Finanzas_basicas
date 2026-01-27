const db = JSON.parse(localStorage.getItem('financeDB')) || {
  movements: [],
  debts: []
};

let currentDate = new Date();
let chart;

function saveDB() {
  localStorage.setItem('financeDB', JSON.stringify(db));
  updateBalance();
  renderCalendar();
  renderDebts();
  renderChart();
}

function updateBalance() {
  let total = 0;
  db.movements.forEach(m => {
    total += m.type === 'ingreso' ? m.amount : -m.amount;
  });
  balance.innerText = `$${total}`;
}

function addMovement() {
  db.movements.push({
    date: movDate.value,
    type: movType.value,
    title: movTitle.value,
    desc: movDesc.value,
    amount: Number(movAmount.value)
  });
  saveDB();
}

function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  monthLabel.innerText = currentDate.toLocaleDateString('es', {
    month: 'long',
    year: 'numeric'
  });

  calendarGrid.innerHTML = '';

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) calendarGrid.innerHTML += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasMov = db.movements.some(m => m.date === date);

    calendarGrid.innerHTML += `
      <div class="day ${hasMov ? 'has' : ''}"
           onclick="movDate.value='${date}'">${d}</div>
    `;
  }
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

function renderChart() {
  const data = {};
  db.movements
    .filter(m => m.type === 'egreso')
    .forEach(m => data[m.title] = (data[m.title] || 0) + m.amount);

  if (chart) chart.destroy();

  chart = new Chart(expensesChart, {
    type: 'pie',
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data) }]
    }
  });
}

function exportTXT() {
  let txt = 'dia;titulo;descripcion;monto\n';
  db.movements.forEach(m => {
    txt += `${m.date};${m.title};${m.desc || ''};${m.amount}\n`;
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'finanzas.txt';
  a.click();
}

function addDebt() {
  const d = {
    type: debtType.value,
    person: debtPerson.value,
    title: debtTitle.value,
    desc: debtDesc.value,
    amount: Number(debtAmount.value),
    date: debtDate.value,
    remaining: Number(debtAmount.value)
  };

  db.debts.push(d);

  db.movements.push({
    date: d.date,
    type: d.type === 'meDeben' ? 'egreso' : 'ingreso',
    title: 'Préstamo ' + d.title,
    desc: d.desc,
    amount: d.amount
  });

  saveDB();
}

function renderDebts() {
  debtList.innerHTML = '';
  db.debts.forEach((d, i) => {
    debtList.innerHTML += `
      <div class="card">
        <b>${d.title}</b> (${d.person})
        <p>Restante: $${d.remaining}</p>
        <input type="number" id="p${i}" placeholder="Abono" />
        <button class="primary" onclick="payDebt(${i})">Abonar</button>
      </div>
    `;
  });
}

function payDebt(i) {
  const value = Number(document.getElementById('p' + i).value);
  const d = db.debts[i];

  d.remaining -= value;

  db.movements.push({
    date: new Date().toISOString().slice(0, 10),
    type: d.type === 'meDeben' ? 'ingreso' : 'egreso',
    title: 'Abono ' + d.title,
    desc: '',
    amount: value
  });

  if (d.remaining <= 0) db.debts.splice(i, 1);
  saveDB();
}

function renderFiltered() {
  filterResults.innerHTML = '';
  db.movements
    .filter(m =>
      m.title.toLowerCase().includes(filterTitle.value.toLowerCase()) &&
      m.amount >= Number(filterAmount.value || 0)
    )
    .forEach(m => {
      filterResults.innerHTML += `<p>${m.date} | ${m.title} | $${m.amount}</p>`;
    });
}

function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

updateBalance();
renderCalendar();
renderDebts();
renderChart();
