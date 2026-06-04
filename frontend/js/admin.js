// ── ADMIN PANEL AND DASHBOARD OPERATIONS ──
let adminFilter = { status: '', cat: '' };
let currentAdminPassword = '';

function togglePasswordVisibility() {
  const passInput = document.getElementById('admin-pass');
  const eyeIcon = document.getElementById('eye-icon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.textContent = '🙈'; // Closed eye/different icon to indicate hide
  } else {
    passInput.type = 'password';
    eyeIcon.textContent = '👁️';
  }
}

function doAdminLogin() {
  const e = document.getElementById('admin-email').value.trim();
  const p = document.getElementById('admin-pass').value.trim();
  if (e === 'admin@surakshasetu.org' && p !== '') {
    adminLoggedIn = true;
    currentAdminPassword = p; // Store the entered password for API calls
    document.getElementById('admin-login-wrap').style.display = 'none';
    document.getElementById('admin-dashboard').classList.add('active');
    renderAdminDashboard();
    showToast('Welcome back, Admin!');
  } else {
    showToast('Invalid credentials. Please enter email and password.');
  }
}

function adminLogout() {
  showConfirmModal(
    'Logout?',
    'Are you sure you want to log out from the admin dashboard?',
    'Yes, Logout',
    'Cancel',
    () => {
      adminLoggedIn = false;
      currentAdminPassword = '';
      const loginWrap = document.getElementById('admin-login-wrap');
      const dashboard = document.getElementById('admin-dashboard');
      if (loginWrap) loginWrap.style.display = '';
      if (dashboard) dashboard.classList.remove('active');
      showToast('Logged out successfully.');
      showPage('home');
    }
  );
}

async function renderAdminDashboard() {
  // Only fetch if empty, otherwise use currentReports to prevent slow UI
  if (currentReports.length === 0) await fetchReports();
  const total = currentReports.length;
  const resolved = currentReports.filter(r => r.status === 'Resolved').length;
  const inprog = currentReports.filter(r => r.status === 'In Progress').length;
  const high = currentReports.filter(r => r.priority === 'High').length;
  const adminStats = document.getElementById('admin-stats');

  if (adminStats) {
    adminStats.innerHTML = `
      <div class="stat-card"><div class="stat-card-val">${total}</div><div class="stat-card-label">Total Reports</div><div class="stat-card-trend">Live Data</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#dc2626">${high}</div><div class="stat-card-label">High Priority</div><div class="stat-card-trend" style="color:var(--red)">Needs attention</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#d97706">${inprog}</div><div class="stat-card-label">In Progress</div><div class="stat-card-trend">Active drives</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#16a34a">${resolved}</div><div class="stat-card-label">Resolved</div><div class="stat-card-trend">↑ ${total > 0 ? Math.round(resolved / total * 100) : 0}% rate</div></div>`;
  }
  renderChart();

  let filtered = currentReports;
  if (adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if (adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);
  renderAdminTable(filtered);
  initCustomSelects(); // Initialize header selects
}

function renderChart() {
  const cats = ['Garbage', 'Plastic Waste', 'Dirty Area', 'Junkyard', 'Water Pollution', 'Plantation Opportunity'];
  const counts = cats.map(c => currentReports.filter(r => r.cat === c).length);
  const max = Math.max(...counts, 1);
  const colors = ['#ef4444', '#f97316', '#eab308', '#d97706', '#3b82f6', '#22c55e'];
  const adminChart = document.getElementById('admin-chart');

  if (adminChart) {
    adminChart.innerHTML = cats.map((c, i) => `
      <div class="chart-bar-wrap">
        <div class="chart-bar-val" style="transform:translateZ(20px)">${counts[i]}</div>
        <div class="chart-bar" style="height:${Math.round((counts[i] / max) * 80) + 4}px;background:${colors[i]}">
          <div class="chart-bar-top"></div>
        </div>
        <div class="chart-bar-label" style="transform:translateZ(20px)">${c.split(' ')[0]}</div>
      </div>`).join('');
  }
}

function filterAdminTable(val, type) {
  adminFilter[type] = val;
  let filtered = currentReports;
  if (adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if (adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);
  renderAdminTable(filtered);
}

function renderAdminTable(reports) {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;
  tbody.innerHTML = reports.map(r => {
    const col = CAT_COLORS[r.cat] || CAT_COLORS.Other;
    return `<tr>
      <td><span class="report-id">${r.id}</span></td>
      <td><span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:800;background:${col.bg};color:${col.color};font-family:Outfit,sans-serif">${col.emoji} ${r.cat}</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.loc}</td>
      <td>${r.date}</td>
      <td><span class="priority-badge ${(r.priority || 'Medium').toLowerCase()}">${r.priority || 'Medium'}</span></td>
      <td>
        <select class="status-select" onchange="updateStatus('${r.id}',this.value)">
          ${['Reported', 'Verified', 'Action Planned', 'In Progress', 'Resolved'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="action-btn action-btn-view" onclick="openModal('${r.id}')">View</button>
          <button class="action-btn action-btn-edit" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;" onclick="deleteReport('${r.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Initialize dynamic row selects
  setTimeout(initCustomSelects, 0);
}

async function updateStatus(id, status) {
  try {
    const formData = new FormData();
    formData.append('report_id', id);
    formData.append('status', status);
    formData.append('admin_password', currentAdminPassword);

    const res = await fetch(`${API_URL}/api/update_status.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${id} → ${status}`);
      const report = currentReports.find(r => r.id === id);
      if (report) report.status = status;
      if (adminLoggedIn) {
        renderAdminDashboard();
      }
    } else {
      showToast('❌ Failed to update status: ' + data.message);
    }
  } catch (e) {
    console.error("Status update error", e);
    showToast('❌ Failed to update status');
  }
}

async function deleteReport(id) {
  showConfirmModal(
    'Delete Report?',
    `Are you sure you want to permanently delete report ${id}? This action cannot be undone.`,
    'Yes, Delete',
    'Cancel',
    async () => {
      try {
        const formData = new FormData();
        formData.append('report_id', id);
        formData.append('admin_password', currentAdminPassword);

        const res = await fetch(`${API_URL}/api/delete_report.php`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          showToast(`✅ Report ${id} deleted`);
          
          // Force refresh reports across the app
          await fetchReports(true); 
          
          if (adminLoggedIn) {
            renderAdminDashboard();
          }
        } else {
          showToast('❌ Failed to delete: ' + data.message);
        }
      } catch (e) {
        console.error("Delete error", e);
        showToast('❌ Failed to delete report');
      }
    }
  );
}

function exportCSV() {
  let filtered = currentReports;
  if (adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if (adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);

  if (filtered.length === 0) {
    showToast('⚠️ No data to export');
    return;
  }

  const headers = ['ID', 'Category', 'Location', 'Latitude', 'Longitude', 'Status', 'Priority', 'Date', 'Reporter', 'Description'];
  const csvRows = [headers.join(',')];

  for (const r of filtered) {
    const row = [
      r.id,
      `"${r.cat}"`,
      `"${r.loc.replace(/"/g, '""')}"`,
      r.lat,
      r.lng,
      `"${r.status}"`,
      `"${r.priority}"`,
      `"${r.date}"`,
      `"${(r.reporter || '').replace(/"/g, '""')}"`,
      `"${(r.desc || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  }

  const csvData = csvRows.join('\n');
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'eco_warrior_reports.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('✅ CSV Exported successfully!');
}

async function exportPremiumPDF() {
  if (typeof html2pdf === 'undefined') {
    showToast('⚠️ PDF library loading. Please try again in a moment.');
    return;
  }

  showToast('⏳ Generating premium PDF...');

  let filtered = currentReports;
  if(adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if(adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);

  if (filtered.length === 0) {
    showToast('⚠️ No data to export');
    return;
  }

  const resolvedCount = filtered.filter(r => r.status === 'Resolved').length;
  const highPriorityCount = filtered.filter(r => r.priority === 'High').length;
  const dateStr = new Date().toLocaleString();

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.innerHTML = `
    <div class="pdf-header">
      <div class="pdf-title-area">
        <h1>🌿 SurakshaSetu Reports</h1>
        <p>Premium Environmental Action Dashboard Export</p>
      </div>
      <div class="pdf-meta">
        <div class="label">Generated On</div>
        <div class="value">${dateStr}</div>
      </div>
    </div>

    <div class="pdf-stats-row">
      <div class="pdf-stat-box">
        <div class="pdf-stat-value">${filtered.length}</div>
        <div class="pdf-stat-label">Total Reports</div>
      </div>
      <div class="pdf-stat-box">
        <div class="pdf-stat-value">${resolvedCount}</div>
        <div class="pdf-stat-label">Resolved Issues</div>
      </div>
      <div class="pdf-stat-box">
        <div class="pdf-stat-value" style="color:var(--red)">${highPriorityCount}</div>
        <div class="pdf-stat-label">High Priority</div>
      </div>
    </div>

    <div class="pdf-table-wrap">
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Report ID</th>
            <th>Category</th>
            <th>Location</th>
            <th>Status</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => {
            const col = CAT_COLORS[r.cat] || CAT_COLORS.Other;
            const priorityClass = (r.priority || 'Medium').toLowerCase();
            return `
            <tr>
              <td><span class="pdf-id">${r.id}</span></td>
              <td><span class="pdf-cat-badge" style="background:${col.bg};color:${col.color}">${col.emoji} ${r.cat}</span></td>
              <td>${r.loc}</td>
              <td style="font-weight:700">${r.status}</td>
              <td><span class="pdf-priority ${priorityClass}">${r.priority || 'Medium'}</span></td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="pdf-footer">
      Suraksha Setu Civic Action Platform • Confidential & Internal Use Only • Printed via NGO Dashboard
    </div>
  `;

  const opt = {
    margin:       [0, 0, 0, 0],
    filename:     'surakshasetu_premium_report.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(container).save();
    showToast('✅ Premium PDF downloaded successfully!');
  } catch(e) {
    console.error('PDF Error:', e);
    showToast('❌ Failed to generate PDF');
  }
}