async function loadRequests() {
  try {
    const response = await fetch('/api/dashboard/requests');
    if (!response.ok) throw new Error('Failed to load requests');
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function renderDashboard() {
  const requests = await loadRequests();
  const totalRequests = requests.length;
  const newRequests = requests.filter((r) => r.badge === 'new').length;
  const processingRequests = requests.filter((r) => r.badge === 'pending').length;
  const completedRequests = requests.filter((r) => r.badge !== 'new' && r.badge !== 'pending' && r.badge !== 'blocked').length;

  // إظهار/إخفاء الصناديق بناءً على وجود البيانات
  const cardTotal = document.getElementById('card-total');
  const cardNew = document.getElementById('card-new');
  const cardProcessing = document.getElementById('card-processing');
  const cardCompleted = document.getElementById('card-completed');

  if (totalRequests > 0) {
    cardTotal.classList.remove('hidden');
    document.getElementById('totalRequests').textContent = totalRequests;
  } else {
    cardTotal.classList.add('hidden');
  }

  if (newRequests > 0) {
    cardNew.classList.remove('hidden');
    document.getElementById('newRequests').textContent = newRequests;
  } else {
    cardNew.classList.add('hidden');
  }

  if (processingRequests > 0) {
    cardProcessing.classList.remove('hidden');
    document.getElementById('processingRequests').textContent = processingRequests;
  } else {
    cardProcessing.classList.add('hidden');
  }

  if (completedRequests > 0) {
    cardCompleted.classList.remove('hidden');
    document.getElementById('completedRequests').textContent = completedRequests;
  } else {
    cardCompleted.classList.add('hidden');
  }

  // إظهار/إخفاء الجدول
  const tablePanel = document.getElementById('requestsPanel');
  if (requests.length > 0) {
    tablePanel.classList.remove('hidden');
    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = requests
      .map(
        (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${item.customer}</td>
          <td><span class="badge ${item.badge}">${item.status}</span></td>
          <td>${item.stage}</td>
          <td>${item.updated}</td>
        </tr>
      `
      )
      .join('');
  } else {
    tablePanel.classList.add('hidden');
  }
}

function updateClock() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

window.addEventListener('DOMContentLoaded', async () => {
  await renderDashboard();
  updateClock();
  setInterval(updateClock, 1000);
});
