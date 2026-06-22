// ── ADMIN PANEL AND DASHBOARD OPERATIONS ──
let adminFilter = { status: '', cat: '' };

async function adminFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken');
  if (!options.headers) {
    options.headers = {};
  }
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  
  const res = await fetch(url, options);
  if (res.status === 401) {
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminRole');
    sessionStorage.removeItem('adminEmail');
    
    const loginWrap = document.getElementById('admin-login-wrap');
    const dashboard = document.getElementById('admin-dashboard');
    if (loginWrap) loginWrap.style.display = '';
    if (dashboard) dashboard.classList.remove('active');
    
    showToast('❌ Session expired. Please log in again.');
    throw new Error('Unauthorized');
  }
  return res;
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('admin-pass');
  const eyeIcon = document.getElementById('eye-icon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.classList.remove('ph-eye-slash');
    eyeIcon.classList.add('ph-eye');
    eyeIcon.textContent = '';
  } else {
    passInput.type = 'password';
    eyeIcon.classList.remove('ph-eye');
    eyeIcon.classList.add('ph-eye-slash');
    eyeIcon.textContent = '';
  }
}

async function doAdminLogin() {
  const e = document.getElementById('admin-email').value.trim();
  const p = document.getElementById('admin-pass').value.trim();
  
  if (!e || !p) {
    showToast('Please enter both email and password.');
    return;
  }

  const btn = document.querySelector('#login-form-card .login-cta');
  const emailInput = document.getElementById('admin-email');
  const passInput = document.getElementById('admin-pass');
  
  const oldText = btn.innerHTML;
  btn.innerHTML = `
    <span class="font-['Poppins',sans-serif] flex items-center gap-2">
      <i class="ph-bold ph-spinner animate-spin text-[18px]"></i> Signing In...
    </span>
  `;
  btn.disabled = true;
  if (emailInput) emailInput.disabled = true;
  if (passInput) passInput.disabled = true;

  const formData = new FormData();
  formData.append('email', e);
  formData.append('password', p);

  try {
    const res = await fetch(`${API_URL}/api/admin_login.php`, {
      method: 'POST',
      body: formData
    });
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse response JSON:', text);
      showToast('❌ Server error. Received invalid response.');
      return;
    }
    
    if (data.success) {
      adminLoggedIn = true;
      sessionStorage.setItem('adminLoggedIn', 'true');
      sessionStorage.setItem('adminToken', data.token);
      sessionStorage.setItem('adminRole', data.role);
      sessionStorage.setItem('adminEmail', data.email);
      
      const rememberCheckbox = document.getElementById('admin-remember');
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('savedAdminEmail', e);
        localStorage.setItem('adminRememberMe', 'true');
      } else {
        localStorage.removeItem('savedAdminEmail');
        localStorage.removeItem('adminRememberMe');
      }
      document.getElementById('admin-login-wrap').style.display = 'none';
      document.getElementById('admin-dashboard').classList.add('active');
      
      if (typeof initRealtime === 'function') {
        initRealtime();
      }
      
      const parts = window.location.hash.substring(1).split('/');
      const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
      renderAdminDashboard(sub);
      showToast('Welcome back, Admin!');
    } else {
      const msg = data.message || data.error || 'Invalid credentials';
      showToast(msg.startsWith('❌') ? msg : '❌ ' + msg);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Login failed. Please check your connection.');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
    if (emailInput) emailInput.disabled = false;
    if (passInput) passInput.disabled = false;
  }
}

function adminLogout() {
  // 1. Fire-and-forget server logout (Background)
  try {
    const formData = new FormData();
    formData.append('action', 'logout');
    adminFetch(`${API_URL}/api/login_sessions.php`, {
      method: 'POST',
      body: formData
    }).catch(() => {}); // Do not await to prevent blocking UI
  } catch (e) {}
  
  // 2. Clear state instantly
  adminLoggedIn = false;
  sessionStorage.clear();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('auth');
  
  // 3. Reset form state instantly
  const emailField = document.getElementById('admin-email');
  const passField = document.getElementById('admin-pass');
  const rememberCheckbox = document.getElementById('admin-remember');
  
  if (passField) passField.value = '';
  if (emailField) emailField.value = '';
  if (rememberCheckbox) rememberCheckbox.checked = false;
  
  if (localStorage.getItem('adminRememberMe') === 'true') {
    if (emailField) emailField.value = localStorage.getItem('savedAdminEmail') || '';
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }
  
  if (typeof destroyRealtime === 'function') {
    destroyRealtime();
  }
  
  // 4. Instant UI navigation to login page
  const loginWrap = document.getElementById('admin-login-wrap');
  const dashboard = document.getElementById('admin-dashboard');
  if (loginWrap) loginWrap.style.display = '';
  if (dashboard) dashboard.classList.remove('active');
  showToast('Logged out successfully.');
  showPage('admin');
}

async function renderAdminDashboard(initialView = 'overview') {
  // Only fetch if empty, otherwise use currentReports to prevent slow UI
  if (currentReports.length === 0) await fetchReports();
  if (!templatesFetched) fetchTemplates(); // preload templates for instant loading
  if (typeof fetchAlerts === 'function') fetchAlerts(); // load alert states for dashboard overview widgets

  const total = currentReports.length;
  const resolved = currentReports.filter(r => r.status === 'Resolved').length;
  const inprog = currentReports.filter(r => r.status === 'In Progress').length;
  const high = currentReports.filter(r => r.priority === 'High').length;

  // LAZY LOADING CHARTS: We do NOT render overview, stat, analytics, and heatmaps here.
  // Instead, they are called inside switchAdminView when their tab is displayed.
  const activeSubView = initialView || 'overview';
  const linkElement = document.querySelector(`.admin-subnav-link[onclick*="'${activeSubView}'"]`) || 
                      document.querySelector(`.admin-subnav-link[onclick*="${activeSubView}"]`) ||
                      document.querySelector(`.admin-nav-link[onclick*="'${activeSubView}'"]`) ||
                      document.querySelector(`.admin-nav-link[onclick*="${activeSubView}"]`);
  
  if (typeof switchAdminView === 'function') {
    switchAdminView(activeSubView, linkElement);
  }

  let filtered = currentReports;
  if (adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if (adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);
  renderAdminTable(filtered);
  initCustomSelects(); // Initialize header selects
}

function renderDashboardOverview() {
  const total = currentReports.length;
  const resolvedCount = currentReports.filter(r => r.status === 'Resolved').length;
  const inprogCount = currentReports.filter(r => r.status === 'In Progress').length;
  const highPriority = currentReports.filter(r => r.priority === 'High').length;

  const adminStats = document.getElementById('admin-stats');
  if (adminStats) {
    adminStats.innerHTML = `
      <div class="stat-card"><div class="stat-card-val">${total}</div><div class="stat-card-label">Total Reports</div><div class="stat-card-trend">Live Data</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#dc2626">${highPriority}</div><div class="stat-card-label">High Priority</div><div class="stat-card-trend" style="color:var(--red)">Needs attention</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#d97706">${inprogCount}</div><div class="stat-card-label">In Progress</div><div class="stat-card-trend">Active drives</div></div>
      <div class="stat-card"><div class="stat-card-val" style="color:#16a34a">${resolvedCount}</div><div class="stat-card-label">Resolved</div><div class="stat-card-trend">↑ ${total > 0 ? Math.round(resolvedCount / total * 100) : 0}% rate</div></div>`;
  }

  const cats = ['Garbage', 'Plastic Waste', 'Dirty Area', 'Junkyard', 'Water Pollution', 'Plantation Opportunity'];
  const counts = cats.map(c => currentReports.filter(r => r.cat === c).length);
  const max = Math.max(...counts, 1);
  const colors = ['#ef4444', '#f97316', '#eab308', '#d97706', '#3b82f6', '#22c55e'];
  const adminChart = document.getElementById('admin-chart-overview');

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

  // Render new dynamic widgets
  renderActiveZones();
  renderLiveActivityFeed();
  if (typeof renderAlertWidgets === 'function') renderAlertWidgets();
}


const chartInstances = {};

function renderStatCharts() {
  const total = currentReports.length;
  if (total === 0) return; // Prevent divide by zero

  // --- 1. KPI Calculations ---
  let resolvedCount = 0;
  let highPriorityCount = 0;
  let totalResolveTimeMs = 0;
  let resolvedWithTime = 0;
  let uniqueReporters = new Set();
  
  let oldestDate = new Date();
  
  currentReports.forEach(r => {
    if (r.device_id) {
      uniqueReporters.add(r.device_id);
    }
    if (r.status === 'Resolved') resolvedCount++;
    if (r.priority === 'High') highPriorityCount++;
    
    let cDate = new Date(r.created_at || r.date);
    if (cDate < oldestDate) oldestDate = cDate;

    if (r.status === 'Resolved' && r.resolved_at && r.created_at) {
      let rDate = new Date(r.resolved_at);
      totalResolveTimeMs += (rDate - cDate);
      resolvedWithTime++;
    }
  });

  const daysSinceOldest = Math.max(1, Math.ceil((new Date() - oldestDate) / (1000 * 60 * 60 * 24)));
  const reportsPerDay = (total / daysSinceOldest).toFixed(1);
  const activeUsers = uniqueReporters.size;
  const escRate = ((highPriorityCount / total) * 100).toFixed(1);
  const resRate = ((resolvedCount / total) * 100).toFixed(1);

  let avgResolveStr = '--';
  let satisfaction = 4.0; 
  if (resolvedWithTime > 0) {
    const avgMs = totalResolveTimeMs / resolvedWithTime;
    const avgHours = avgMs / (1000 * 60 * 60);
    if (avgHours < 24) {
      avgResolveStr = avgHours.toFixed(1) + 'h';
      satisfaction += 0.8;
    } else {
      avgResolveStr = (avgHours / 24).toFixed(1) + 'd';
      satisfaction += (avgHours/24 < 3) ? 0.5 : 0;
    }
  }
  satisfaction += (resolvedCount / total) * 0.2;
  satisfaction = Math.min(5.0, satisfaction).toFixed(1);

  document.getElementById('stat-avg-time').innerText = avgResolveStr;
  document.getElementById('stat-reports-day').innerText = reportsPerDay;
  document.getElementById('stat-active-users').innerText = activeUsers;
  document.getElementById('stat-escalation').innerText = escRate + '%';
  document.getElementById('stat-resolution').innerText = resRate + '%';
  document.getElementById('stat-satisfaction').innerText = satisfaction + '★';

  // --- 2. Monthly Report Volume ---
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let monthlyCounts = {};
  for (let i = 5; i >= 0; i--) {
    let d = new Date();
    d.setMonth(d.getMonth() - i);
    monthlyCounts[d.getFullYear() + '-' + d.getMonth()] = { name: monthNames[d.getMonth()], count: 0 };
  }
  currentReports.forEach(r => {
    let d = new Date(r.created_at || r.date);
    let key = d.getFullYear() + '-' + d.getMonth();
    if (monthlyCounts[key]) monthlyCounts[key].count++;
  });
  const barLabels = Object.values(monthlyCounts).map(m => m.name);
  const barData = Object.values(monthlyCounts).map(m => m.count);

  const bCtx = document.getElementById('barChart');
  if (bCtx) {
    if (chartInstances.bar) {
      chartInstances.bar.data.labels = barLabels;
      chartInstances.bar.data.datasets[0].data = barData;
      chartInstances.bar.update();
    } else {
      chartInstances.bar = new Chart(bCtx, {
        type: 'bar',
        data: {
          labels: barLabels,
          datasets: [{
            label: 'Reports',
            data: barData,
            backgroundColor: '#dcfce7', borderColor: '#22c55e',
            borderWidth: 1, borderRadius: 6, hoverBackgroundColor: '#86efac'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 11, family: 'Outfit' } }, grid: { display: false } },
            y: { ticks: { color: '#64748b', font: { size: 11, family: 'Outfit' } }, grid: { color: '#f1f5f9' } }
          }
        }
      });
    }
  }

  // --- 3. Category Distribution ---
  let catCounts = {};
  currentReports.forEach(r => {
    catCounts[r.cat] = (catCounts[r.cat] || 0) + 1;
  });
  let sortedCats = Object.entries(catCounts).sort((a,b) => b[1]-a[1]);
  let dLabels = sortedCats.map(c => c[0]);
  let dData = sortedCats.map(c => c[1]);
  let dColors = dLabels.map(cat => (CAT_COLORS[cat] ? CAT_COLORS[cat].pin : '#9ca3af'));

  const dCtx = document.getElementById('donutChart');
  if (dCtx) {
    if (chartInstances.donut) {
      chartInstances.donut.data.labels = dLabels;
      chartInstances.donut.data.datasets[0].data = dData;
      chartInstances.donut.data.datasets[0].backgroundColor = dColors;
      chartInstances.donut.update();
    } else {
      chartInstances.donut = new Chart(dCtx, {
        type: 'doughnut',
        data: {
          labels: dLabels,
          datasets: [{ data: dData, backgroundColor: dColors, borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: false, cutout: '68%', plugins: { legend: { display: false } } }
      });
    }
  }

  let legendHtml = sortedCats.map((c, idx) => {
    const pct = Math.round((c[1]/total)*100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--text3);"><div style="width:10px;height:10px;border-radius:50%;background:${dColors[idx]};flex-shrink:0;"></div>${c[0]}<span style="margin-left:auto;font-weight:700;color:var(--text);">${pct}%</span></div>`;
  }).join('');
  document.getElementById('stat-category-legend').innerHTML = legendHtml;

  // --- 4. Top Reporting Zones ---
  let locCounts = {};
  currentReports.forEach(r => {
    locCounts[r.loc] = (locCounts[r.loc] || 0) + 1;
  });
  let sortedZones = Object.entries(locCounts).sort((a,b) => b[1]-a[1]).slice(0, 4);
  const zoneColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  let zonesHtml = sortedZones.map((z, idx) => {
    let act = currentReports.filter(r => r.loc === z[0] && r.status !== 'Resolved').length;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8fafc;border:1px solid var(--border);border-radius:10px;">
              <div style="font-family:'Outfit',sans-serif;font-size:20px;font-weight:800;color:#cbd5e1;min-width:28px;">0${idx+1}</div>
              <div style="flex:1;">
                <div style="font-size:14px;color:var(--text);font-weight:700;margin-bottom:2px;">${z[0]}</div>
                <div style="font-size:12px;color:var(--text3);">${act} active issues</div>
              </div>
              <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:${zoneColors[idx]};">${z[1]}</div>
            </div>`;
  }).join('');
  document.getElementById('stat-top-zones-list').innerHTML = zonesHtml;

  // --- 5. Issue Status Flow ---
  let submitted = total;
  let verified = currentReports.filter(r => ['Verified', 'Action Planned', 'In Progress', 'Resolved'].includes(r.status)).length;
  let inProgress = currentReports.filter(r => ['In Progress', 'Resolved'].includes(r.status)).length;
  let resolved = resolvedCount;

  const flowData = [
    { label: 'Submitted', count: submitted, color1: '#1e3a8a', color2: '#eff6ff', border: '#bfdbfe' },
    { label: 'Verified', count: verified, color1: '#581c87', color2: '#faf5ff', border: '#e9d5ff' },
    { label: 'In Progress', count: inProgress, color1: '#713f12', color2: '#fefce8', border: '#fef08a' },
    { label: 'Resolved', count: resolved, color1: '#14532d', color2: '#f0fdf4', border: '#bbf7d0' }
  ];
  let maxFlow = Math.max(1, submitted);
  
  let flowHtml = flowData.map(f => {
    let w = Math.max(15, Math.round((f.count / maxFlow) * 100));
    return `<div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;color:var(--text3);font-weight:600;"><span>${f.label}</span><span>${f.count}</span></div>
              <div style="height:36px;border-radius:8px;display:flex;align-items:center;padding:0 14px;font-size:13px;font-weight:700;color:${f.color1};width:${w}%;background:${f.color2};border:1px solid ${f.border};white-space:nowrap;overflow:hidden;">${f.label} — ${f.count}</div>
            </div>`;
  }).join('');
  document.getElementById('stat-status-flow-list').innerHTML = flowHtml;
}

function renderAnalyticsCharts() {
  const total = currentReports.length;
  if (total === 0) return;

  // --- 1. Peak Reporting Hours ---
  let hourCounts = new Array(24).fill(0);
  currentReports.forEach(r => {
    let d = new Date(r.created_at || r.date);
    hourCounts[d.getHours()]++;
  });
  
  const hCtx = document.getElementById('hourChart');
  if(hCtx) {
    let maxHour = Math.max(...hourCounts, 1);
    if (chartInstances.hour) {
      chartInstances.hour.data.datasets[0].data = hourCounts;
      chartInstances.hour.data.datasets[0].backgroundColor = hourCounts.map(v => v > maxHour*0.8 ? '#22c55e' : v > maxHour*0.4 ? '#86efac' : '#dcfce7');
      chartInstances.hour.update();
    } else {
      chartInstances.hour = new Chart(hCtx, {
        type: 'bar',
        data: {
          labels: hourCounts.map((_,i)=>i%6===0?`${i}h`:''),
          datasets: [{
            data: hourCounts,
            backgroundColor: hourCounts.map(v => v > maxHour*0.8 ? '#22c55e' : v > maxHour*0.4 ? '#86efac' : '#dcfce7'),
            borderRadius: 3, borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 9, family:'Outfit' } }, grid: { display: false } },
            y: { ticks: { color: '#64748b', font: { size: 9, family:'Outfit' } }, grid: { color: '#f1f5f9' } }
          }
        }
      });
    }
  }

  // --- 2. 6-Month Trend (Reported vs Resolved) ---
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let trendLabels = [];
  let reportedCounts = [0,0,0,0,0,0];
  let resolvedCounts = [0,0,0,0,0,0];
  
  for (let i = 5; i >= 0; i--) {
    let d = new Date();
    d.setMonth(d.getMonth() - i);
    trendLabels.push(monthNames[d.getMonth()]);
  }
  
  currentReports.forEach(r => {
    let cDate = new Date(r.created_at || r.date);
    let monthDiff = (new Date().getFullYear() - cDate.getFullYear()) * 12 + (new Date().getMonth() - cDate.getMonth());
    if (monthDiff >= 0 && monthDiff <= 5) {
      reportedCounts[5 - monthDiff]++;
    }
    
    if (r.status === 'Resolved' && r.resolved_at) {
      let rDate = new Date(r.resolved_at);
      let rMonthDiff = (new Date().getFullYear() - rDate.getFullYear()) * 12 + (new Date().getMonth() - rDate.getMonth());
      if (rMonthDiff >= 0 && rMonthDiff <= 5) {
        resolvedCounts[5 - rMonthDiff]++;
      }
    }
  });

  const lCtx = document.getElementById('lineChart');
  if(lCtx) {
    if (chartInstances.line) {
      chartInstances.line.data.labels = trendLabels;
      chartInstances.line.data.datasets[0].data = reportedCounts;
      chartInstances.line.data.datasets[1].data = resolvedCounts;
      chartInstances.line.update();
    } else {
      chartInstances.line = new Chart(lCtx, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [
            { label: 'Reported', data: reportedCounts, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: '#3b82f6', pointRadius: 4 },
            { label: 'Resolved', data: resolvedCounts, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: '#22c55e', pointRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, family:'Outfit' }, boxWidth: 10, boxHeight: 10 } } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 11, family:'Outfit' } }, grid: { display: false } },
            y: { ticks: { color: '#64748b', font: { size: 11, family:'Outfit' } }, grid: { color: '#f1f5f9' } }
          }
        }
      });
    }
  }

  // --- 3. Resolution Speed ---
  let bins = { 'same': 0, '1to3': 0, '4to7': 0, '7plus': 0 };
  let resolvedTotal = 0;
  currentReports.forEach(r => {
    if (r.status === 'Resolved' && r.resolved_at && r.created_at) {
      resolvedTotal++;
      let days = (new Date(r.resolved_at) - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
      if (days <= 1) bins['same']++;
      else if (days <= 3) bins['1to3']++;
      else if (days <= 7) bins['4to7']++;
      else bins['7plus']++;
    }
  });
  
  if (resolvedTotal > 0) {
    document.getElementById('res-speed-sameday').innerText = Math.round((bins['same']/resolvedTotal)*100) + '%';
    document.getElementById('res-bar-sameday').style.width = Math.round((bins['same']/resolvedTotal)*100) + '%';
    
    document.getElementById('res-speed-1to3').innerText = Math.round((bins['1to3']/resolvedTotal)*100) + '%';
    document.getElementById('res-bar-1to3').style.width = Math.round((bins['1to3']/resolvedTotal)*100) + '%';
    
    document.getElementById('res-speed-4to7').innerText = Math.round((bins['4to7']/resolvedTotal)*100) + '%';
    document.getElementById('res-bar-4to7').style.width = Math.round((bins['4to7']/resolvedTotal)*100) + '%';
    
    document.getElementById('res-speed-7plus').innerText = Math.round((bins['7plus']/resolvedTotal)*100) + '%';
    document.getElementById('res-bar-7plus').style.width = Math.round((bins['7plus']/resolvedTotal)*100) + '%';
  } else {
    ['sameday', '1to3', '4to7', '7plus'].forEach(id => {
      document.getElementById('res-speed-' + id).innerText = '0%';
      document.getElementById('res-bar-' + id).style.width = '0%';
    });
  }

  // --- 4. User Engagement (Cookie/Device Tracking) ---
  let userCounts = {};
  currentReports.forEach(r => {
    let uid = r.device_id; // Use device_id exclusively for persistent tracking
    if (!uid) return;
    userCounts[uid] = (userCounts[uid] || 0) + 1;
  });
  
  let newReporters = 0;
  let repeatReporters = 0;
  Object.values(userCounts).forEach(count => {
    if (count === 1) newReporters++;
    else if (count > 1) repeatReporters++;
  });
  
  const totalUsers = newReporters + repeatReporters;
  const repeatPct = totalUsers > 0 ? ((repeatReporters / totalUsers) * 100).toFixed(1) : 0;
  
  document.getElementById('eng-new-reporters').innerText = '+' + newReporters;
  document.getElementById('eng-repeat-reporters').innerText = repeatReporters;
  document.getElementById('eng-repeat-pct').innerText = repeatPct + '% of total';

  // --- 5. Weekly Report Heatmap ---
  buildHeatmap();
}

function buildHeatmap() {
  const el = document.getElementById('heatmap');
  if(!el) return;
  el.innerHTML = '';
  
  let today = new Date();
  today.setHours(23,59,59,999);
  
  let daysToSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  let endDate = new Date(today.getTime());
  endDate.setDate(today.getDate() + daysToSunday);
  endDate.setHours(23,59,59,999);
  
  let startDate = new Date(endDate.getTime() - 27 * 24 * 60 * 60 * 1000);
  startDate.setHours(0,0,0,0);
  
  let heatmapData = new Array(28).fill(0);
  
  currentReports.forEach(r => {
    let d = new Date(r.created_at || r.date);
    if (d >= startDate && d <= today) {
      let dayIndex = Math.floor((d - startDate) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 28) {
        heatmapData[dayIndex]++;
      }
    }
  });

  const max = Math.max(...heatmapData, 1);
  heatmapData.forEach(v => {
    const cell = document.createElement('div');
    const pct = v / max;
    let bg = '#f0fdf4';
    if(pct > 0.8) bg = '#22c55e';
    else if(pct > 0.6) bg = '#4ade80';
    else if(pct > 0.4) bg = '#86efac';
    else if(pct > 0.0) bg = '#dcfce7'; 
    
    cell.style.cssText = `height:28px;border-radius:4px;background:${bg};border:1px solid rgba(34,197,94,0.15);cursor:pointer;transition:transform 0.15s;`;
    cell.title = `${v} reports on this day`;
    cell.onmouseenter = () => cell.style.transform = 'scale(1.15)';
    cell.onmouseleave = () => cell.style.transform = 'scale(1)';
    el.appendChild(cell);
  });
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
    return `<tr data-report-id="${r.id}">
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
        // Also re-render map details if open
        if (selectedMapIssue === id) {
          selectMapIssue(id);
        }
      }
    } else {
      showToast('❌ Failed to update status: ' + data.message);
    }
  } catch (e) {
    console.error("Status update error", e);
    showToast('❌ Failed to update status');
  }
}

async function updatePriority(id, priority) {
  try {
    const formData = new FormData();
    formData.append('report_id', id);
    formData.append('priority', priority);
    formData.append('admin_password', currentAdminPassword);

    const res = await fetch(`${API_URL}/api/update_priority.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${id} Priority → ${priority}`);
      const report = currentReports.find(r => r.id === id);
      if (report) report.priority = priority;
      if (adminLoggedIn) {
        renderAdminDashboard();
        // Also re-render map details if open
        if (selectedMapIssue === id) {
          selectMapIssue(id);
        }
      }
    } else {
      showToast('❌ Failed to update priority: ' + data.message);
    }
  } catch (e) {
    console.error("Priority update error", e);
    showToast('❌ Failed to update priority');
  }
}

async function deleteReport(id) {
  showConfirmModal(
    'Delete Report?',
    `Are you sure you want to permanently delete report ${id}? This action cannot be undone.`,
    'Yes, Delete',
    'Cancel',
    () => {
      // 1. Optimistic UI: Immediately remove from DOM if we are on the Reports List
      const tableRow = document.querySelector(`tr[data-report-id="${id}"]`);
      if (tableRow) tableRow.remove();
      
      // 2. Remove from state arrays immediately
      if (window.ecoReports) {
        window.ecoReports = window.ecoReports.filter(r => r.id !== id);
      }
      if (typeof currentReports !== 'undefined') {
        currentReports = currentReports.filter(r => r.id !== id);
      }
      
      // 3. Show success toast instantly
      showToast(`✅ Report ${id} deleted`);
      
      // 4. Update Overview Dashboard Stats if it's visible, but don't redirect
      if (adminLoggedIn && selectedMapIssue === id) {
        selectedMapIssue = null;
        switchMapPanel('list', document.querySelectorAll('.m-ptab')[0]);
      }

      // 5. Fire async API request in background
      const formData = new FormData();
      formData.append('report_id', id);
      formData.append('admin_password', currentAdminPassword);

      fetch(`${API_URL}/api/delete_report.php`, {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          showToast('❌ Failed to delete: ' + data.message + ' (Reverting)');
          fetchReports(true).then(() => { if (adminLoggedIn) renderReportsList(); });
        }
      })
      .catch(e => {
        console.error("Delete error", e);
        showToast('❌ Network error during deletion (Reverting)');
        fetchReports(true).then(() => { if (adminLoggedIn) renderReportsList(); });
      });
    }
  );
}

function exportReportsExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Excel library loading. Please try again in a moment.');
    return;
  }
  let filtered = currentReports;
  if (adminFilter.status) filtered = filtered.filter(r => r.status === adminFilter.status);
  if (adminFilter.cat) filtered = filtered.filter(r => r.cat === adminFilter.cat);

  if (filtered.length === 0) {
    showToast('⚠️ No data to export');
    return;
  }

  const exportData = filtered.map(r => ({
    'Report ID': r.id,
    'Category': r.cat,
    'Location': r.loc,
    'Latitude': r.lat,
    'Longitude': r.lng,
    'Status': r.status,
    'Priority': r.priority,
    'Date': r.date,
    'Reporter': r.reporter || '',
    'Description': r.desc || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
  XLSX.writeFile(workbook, "SurakshaSetu_Reports.xlsx");
  showToast('✅ Excel Exported successfully!');
}

function exportStatsCSV() {
  const total = currentReports.length;
  const resolvedCount = currentReports.filter(r => r.status === 'Resolved').length;
  const inprogCount = currentReports.filter(r => r.status === 'In Progress').length;
  const highPriority = currentReports.filter(r => r.priority === 'High').length;
  const resRate = total > 0 ? (resolvedCount / total * 100).toFixed(1) + '%' : '0%';
  const escRate = total > 0 ? (highPriority / total * 100).toFixed(1) + '%' : '0%';

  const csvRows = [
    ['Metric', 'Value'],
    ['Total Reports', total],
    ['Resolved Reports', resolvedCount],
    ['In Progress', inprogCount],
    ['High Priority', highPriority],
    ['Resolution Rate', resRate],
    ['Escalation Rate', escRate],
    ['Avg Resolve Time', '2.4d'],
    ['Active Users', 318]
  ];

  const csvData = csvRows.map(e => e.join(",")).join("\\n");
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'surakshasetu_statistics.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✅ Statistics CSV Exported!');
}

function exportAnalyticsData() {
  const analyticsData = {
    generatedAt: new Date().toISOString(),
    peakReportingHours: { "6h": 25, "18h": 24 },
    resolutionSpeed: {
      "SameDay": "28%",
      "1-3Days": "44%",
      "4-7Days": "19%",
      "7+Days": "9%"
    },
    userEngagement: {
      "NewReportersThisMonth": 84,
      "RepeatReporters": 234,
      "RepeatPercentage": "73.6%"
    },
    sixMonthTrend: {
      "months": ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      "reported": [150, 190, 165, 220, 245, 310],
      "resolved": [110, 160, 140, 200, 220, 280]
    }
  };
  
  const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'surakshasetu_analytics.json');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✅ Analytics Data Downloaded!');
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

// ── MONITORING VIEW LOGIC ──
let activeMapFilter = 'all';
let selectedMapIssue = null;
let adminMap = null;
let adminMarkerLayer = null;

function renderMonitoringMap() {
  const monitoringView = document.getElementById('admin-view-monitoring');
  if (!monitoringView || monitoringView.style.display === 'none') return;
  
  if (!adminMap) {
    adminMap = L.map('live-leaflet-map', { zoomControl: false }).setView([27.1767, 78.0081], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(adminMap);
    L.control.zoom({ position: 'topleft' }).addTo(adminMap);
    adminMarkerLayer = L.layerGroup().addTo(adminMap);
  }
  
  setTimeout(() => adminMap.invalidateSize(), 100);

  renderMapList();
  renderMapMarkers();
}

function filterMapIssues(cat, btn) {
  activeMapFilter = cat;
  document.querySelectorAll('.m-fbtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMapList();
  renderMapMarkers();
}

function priorityColor(p) {
  return p==='High'?'#ef4444':p==='Medium'?'#eab308':'#22c55e';
}

function mapStatusToColor(status) {
  return status==='Resolved'?'#9ca3af':status==='In Progress'?'#eab308':'#ef4444';
}

function updateLiveMapStats(filtered) {
  const highEl = document.getElementById('stat-pill-high');
  const activeEl = document.getElementById('stat-pill-active');
  const resolvedEl = document.getElementById('stat-pill-resolved');
  if (!highEl || !activeEl || !resolvedEl) return;

  const high = filtered.filter(r => r.priority && r.priority.toLowerCase() === 'high').length;
  // Let's count anything not resolved as active for the map context
  const active = filtered.filter(r => r.status !== 'Resolved').length;
  const resolved = filtered.filter(r => r.status === 'Resolved').length;

  highEl.textContent = high.toLocaleString();
  activeEl.textContent = active.toLocaleString();
  resolvedEl.textContent = resolved.toLocaleString();
}

function renderMapList() {
  const list = document.getElementById('mIssuesList');
  if(!list) return;
  const filtered = activeMapFilter === 'all' ? currentReports : currentReports.filter(i => i.cat === activeMapFilter);
  
  updateLiveMapStats(filtered);

  list.innerHTML = filtered.map(issue => {
    const col = CAT_COLORS[issue.cat] || CAT_COLORS.Other;
    return `
    <div class="m-card${selectedMapIssue===issue.id?' selected':''}" onclick="selectMapIssue('${issue.id}')">
      <div class="m-ic-header">
        <span class="m-ic-id">${issue.id}</span>
        <span class="m-ic-badge" style="background:${issue.status==='Resolved'?'#f3f4f6':issue.status==='In Progress'?'#fef9c3':'#fee2e2'};color:${mapStatusToColor(issue.status)}">${issue.status}</span>
      </div>
      <div class="m-ic-title">${issue.desc ? issue.desc.substring(0, 40) + '...' : issue.cat + ' issue'}</div>
      <div class="m-ic-meta">
        <span class="m-fcat" style="background:${col.pin};"></span>
        <span style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${issue.loc}</span>
        <span style="color:var(--text3)">·</span>
        <span>${issue.date}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;color:${priorityColor(issue.priority)};">${issue.priority || 'Medium'}</span>
      </div>
    </div>
  `}).join('');
}

function renderMapMarkers() {
  if(!adminMarkerLayer) return;
  adminMarkerLayer.clearLayers();
  
  const filtered = activeMapFilter === 'all' ? currentReports : currentReports.filter(i => i.cat === activeMapFilter);
  
  filtered.forEach(issue => {
    const col = CAT_COLORS[issue.cat] || CAT_COLORS.Other;
    let lat = parseFloat(issue.lat) || (27.1767 + (Math.random() - 0.5) * 0.05);
    let lng = parseFloat(issue.lng) || (78.0081 + (Math.random() - 0.5) * 0.05);
    
    // We remove the static CSS translation from the HTML since Leaflet's iconAnchor handles the positioning perfectly.
    const isHigh = issue.priority && issue.priority.toLowerCase() === 'high';
    const html = `
      <div class="m-mpin" style="transform: scale(${selectedMapIssue===issue.id?'1.25':'1'}); transition: transform 0.2s;">
        <div class="m-mpulse" style="background:${col.pin};opacity:0.25;${isHigh?'':'display:none !important; animation:none !important'}"></div>
        <div class="m-mpin-body" style="background:${col.pin}; border-color: ${selectedMapIssue===issue.id?'#1e293b':'#fff'}; border-width: 2px; ${isHigh?'box-shadow: 0 0 12px '+col.pin+';':''}">
          <div class="m-mpin-inner"></div>
        </div>
      </div>
    `;
    
    const customIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: html,
      iconSize: [30, 36],
      iconAnchor: [15, 36]
    });
    
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(adminMarkerLayer);
    
    // Adding tooltip exactly like the original design
    const tooltipHtml = `
      <div style="font-family:'Outfit',sans-serif; min-width: 160px;">
        <div class="m-tt-title" style="color:${col.pin};font-weight:700;font-size:14px;">${issue.id}</div>
        <div style="font-size:12px;color:#334155;margin-bottom:8px;font-weight:600;">${issue.desc ? issue.desc.substring(0, 30) + '...' : issue.cat}</div>
        <div class="m-tt-row" style="font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;"><span>Location</span><span style="font-weight:700;color:#334155">${issue.loc}</span></div>
        <div class="m-tt-row" style="font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;"><span>Priority</span><span style="font-weight:700;color:${priorityColor(issue.priority)}">${issue.priority || 'Medium'}</span></div>
        <div class="m-tt-row" style="font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;"><span>Status</span><span style="font-weight:700;color:#334155">${issue.status}</span></div>
      </div>
    `;
    
    marker.bindTooltip(tooltipHtml, {
      direction: 'top',
      offset: [0, -38],
      className: 'leaflet-custom-tooltip'
    });
    
    marker.on('click', () => {
      selectMapIssue(issue.id);
    });
  });
}

function selectMapIssue(id) {
  selectedMapIssue = id;
  const issue = currentReports.find(i=>i.id===id);
  if(!issue) return;
  
  if (adminMap) {
    let lat = parseFloat(issue.lat) || (27.1767 + (Math.random() - 0.5) * 0.05);
    let lng = parseFloat(issue.lng) || (78.0081 + (Math.random() - 0.5) * 0.05);
    adminMap.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
  }

  // Re-render markers so the selected one scales up
  renderMapMarkers();
  renderMapList();
  
  const col = CAT_COLORS[issue.cat] || CAT_COLORS.Other;
  const dp = document.getElementById('mDpContent');
  dp.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span class="m-fcat" style="background:${col.pin};"></span>
      <span style="font-size:12px;color:${col.pin};font-weight:700;">${issue.cat}</span>
    </div>
    <div class="m-dp-title">${issue.desc ? issue.desc : issue.cat + ' reported in ' + issue.loc}</div>
    <div class="m-dp-id">${issue.id} · ${issue.date}</div>
    ${issue.photo_urls && issue.photo_urls.length > 0 ? 
      `<div style="width:100%;height:140px;border-radius:10px;overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow2);cursor:pointer;" onclick="openLightbox('${issue.photo_urls[0]}')"><img src="${issue.photo_urls[0]}" style="width:100%;height:100%;object-fit:cover;"></div>` : 
      `<div style="width:100%;height:100px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:var(--text3);font-size:12px;"><i class="ph-duotone ph-image" style="font-size:24px;margin-right:8px;"></i>No photo provided</div>`
    }
    <div class="m-dp-row"><span class="m-dp-lbl">Location</span><span class="m-dp-val">${issue.loc}</span></div>
    <div class="m-dp-row"><span class="m-dp-lbl">Priority</span><span class="m-dp-val" style="color:${priorityColor(issue.priority)}">${issue.priority || 'Medium'}</span></div>
    <div class="m-dp-row"><span class="m-dp-lbl">Status</span><span class="m-dp-val">${issue.status}</span></div>
    <div class="m-dp-row"><span class="m-dp-lbl">Reporter</span><span class="m-dp-val">${issue.reporter || 'Anonymous'}</span></div>
    <div class="m-dp-actions" style="display:flex;gap:8px;margin-top:16px;">
      <div class="m-dp-btn m-dp-btn-success" style="flex:1" onclick="updateStatus('${issue.id}', 'Resolved')"><i class="ph-bold ph-check" style="margin-right:4px;"></i> Resolve</div>
      <div class="m-dp-btn m-dp-btn-warning" style="flex:1" onclick="updatePriority('${issue.id}', 'High')"><i class="ph-bold ph-arrow-up" style="margin-right:4px;"></i> Escalate</div>
      <div class="m-dp-btn m-dp-btn-danger" style="flex:1" onclick="deleteReport('${issue.id}')"><i class="ph-bold ph-trash" style="margin-right:4px;"></i> Delete</div>
    </div>
  `;
  switchMapPanel('detail', document.querySelectorAll('.m-ptab')[1]);
}

function switchMapPanel(name, btn) {
  document.querySelectorAll('.m-ptab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('mIssuesList').style.display = name==='list'?'block':'none';
  document.getElementById('mDetailPanel').style.display = name==='detail'?'block':'none';
  if(name==='detail') document.getElementById('mDetailPanel').classList.add('show');
}

// Sidebar Search Logic
function filterAdminModules(query) {
  const q = query.toLowerCase().trim();
  const clearBtn = document.getElementById('admin-search-clear');
  
  if (q.length > 0) {
    clearBtn.style.display = 'block';
  } else {
    clearBtn.style.display = 'none';
  }

  // Get all nav items
  const navItems = document.querySelectorAll('.admin-nav-item');
  navItems.forEach(item => {
    const parentText = item.querySelector('.admin-sidebar-text')?.textContent.toLowerCase() || '';
    const subnavLinks = item.querySelectorAll('.admin-subnav-link');
    
    let matchFound = false;
    
    // Check subnavs
    subnavLinks.forEach(link => {
      const subText = link.textContent.toLowerCase();
      if (subText.includes(q)) {
        link.style.display = 'block';
        matchFound = true;
      } else {
        link.style.display = 'none';
      }
    });

    // Check parent text
    if (parentText.includes(q) || q === '') {
      // If parent matches, show all subnavs
      subnavLinks.forEach(link => link.style.display = 'block');
      matchFound = true;
    }

    if (matchFound) {
      item.style.display = 'block';
      // Auto-open parent if searching
      if (q.length > 0 && subnavLinks.length > 0) {
        item.classList.add('open');
      }
    } else {
      item.style.display = 'none';
    }
  });
}

function clearAdminSearch() {
  const input = document.getElementById('admin-module-search');
  input.value = '';
  filterAdminModules('');
}

// ── NEW: DYNAMIC ACTIVE ZONES & ACTIVITY FEED ──

function adminTimeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 'just now';
  const diff = Math.floor((new Date() - d) / 1000);
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

let adminZonesMap = null;
let adminZonesMarkers = null;

function renderActiveZones() {
  const mapContainer = document.getElementById('admin-active-zones-map');
  const tagsContainer = document.getElementById('admin-active-zones-tags');
  if (!mapContainer || !tagsContainer) return;

  const activeReports = currentReports.filter(r => r.status !== 'Resolved');
  
  // Calculate location counts
  const locCounts = {};
  let totalActive = 0;
  activeReports.forEach(r => {
    totalActive++;
    const l = r.loc || 'Unknown';
    if (!locCounts[l]) locCounts[l] = { active: 0, high: 0 };
    locCounts[l].active++;
    if (r.priority === 'High') locCounts[l].high++;
  });

  const sortedLocs = Object.entries(locCounts).sort((a, b) => b[1].active - a[1].active).slice(0, 4);
  const tagColors = [
    { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' }, // Red
    { bg: 'rgba(245,158,11,0.1)', text: '#d97706' }, // Orange
    { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' }, // Blue
    { bg: 'rgba(34,197,94,0.1)', text: '#16a34a' }   // Green
  ];

  tagsContainer.innerHTML = sortedLocs.map((loc, i) => {
    const col = tagColors[i % tagColors.length];
    return `<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:${col.bg};color:${col.text};text-transform:uppercase;">
      ${loc[0]} — ${loc[1].active} Active ${loc[1].high > 0 ? `(${loc[1].high} High)` : ''}
    </div>`;
  }).join('');

  if (sortedLocs.length === 0) {
    tagsContainer.innerHTML = `<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--bg3);color:var(--text3);text-transform:uppercase;">No Active Zones</div>`;
  }

  // Initialize Leaflet Map if not created
  if (!adminZonesMap) {
    adminZonesMap = L.map('admin-active-zones-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([30.0668, 79.0193], 7); // Uttarakhand default view

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18
    }).addTo(adminZonesMap);

    adminZonesMarkers = L.layerGroup().addTo(adminZonesMap);
  } else {
    adminZonesMarkers.clearLayers();
  }

  // Add markers
  let bounds = L.latLngBounds();
  activeReports.forEach(r => {
    if (!r.lat || !r.lng) return;
    const colorObj = CAT_COLORS[r.cat] || CAT_COLORS.Other;
    const color = colorObj.pin;
    
    // Make dots slightly larger for high priority
    const size = r.priority === 'High' ? 14 : 10;
    const opacity = r.priority === 'High' ? 0.9 : 0.7;

    const markerHtml = `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;box-shadow:0 0 8px ${color};opacity:${opacity};border:2px solid white;"></div>`;
    
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: markerHtml,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });

    const marker = L.marker([r.lat, r.lng], { icon }).addTo(adminZonesMarkers);
    marker.bindTooltip(`<b>${r.cat}</b><br>${r.loc}<br>${r.priority} Priority`);
    bounds.extend([r.lat, r.lng]);
  });

  if (activeReports.length > 0) {
    adminZonesMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
  } else {
    adminZonesMap.setView([30.0668, 79.0193], 7);
  }
}

async function renderLiveActivityFeed() {
  const feedContainer = document.getElementById('admin-live-activity-feed');
  if (!feedContainer) return;

  try {
    const res = await fetch(`${API_URL}/api/get_activity_logs.php`);
    const logs = await res.json();
    
    if (!logs || logs.length === 0) {
      feedContainer.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px;">No recent activity</div>';
      return;
    }

    feedContainer.innerHTML = logs.slice(0, 15).map(log => {
      let dotColor = '#94a3b8'; // default
      if (log.event_type === 'Report Created') dotColor = '#3b82f6';
      else if (log.event_type === 'Status Changed') dotColor = '#10b981';
      else if (log.event_type === 'Priority Changed') dotColor = '#ef4444';
      else if (log.event_type === 'Certificate Issued') dotColor = '#f59e0b';

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};flex-shrink:0;"></div>
            <span style="font-size:13px;color:var(--text);font-weight:500;">${log.description}</span>
          </div>
          <span style="font-size:11px;color:var(--text3);white-space:nowrap;margin-left:12px;">${adminTimeAgo(log.created_at)}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load activity logs:', err);
  }
}

let currentBuilderMode = 'design';
let tinymceEditor = null;
let codemirrorEditor = null;
let currentEditingTemplateId = null;
let allTemplates = [];

function openCreateTemplateModal() {
  currentEditingTemplateId = null;
  document.getElementById('builder-tpl-name').value = '';
  document.getElementById('builder-tpl-award').value = '';
  if (tinymceEditor) tinymceEditor.setContent('');
  if (codemirrorEditor) codemirrorEditor.setValue('');
  document.getElementById('template-mode-selector-overlay').classList.add('open');
}

function closeTemplateModeSelector() {
  document.getElementById('template-mode-selector-overlay').classList.remove('open');
}

function openTemplateBuilder(mode) {
  closeTemplateModeSelector();
  currentBuilderMode = mode;
  document.getElementById('template-builder-overlay').style.display = 'flex';
  document.getElementById('builder-mode-indicator').innerText = mode === 'design' ? 'Design Editor' : 'Code Editor';
  
  let initialContent = '';
  if (currentEditingTemplateId) {
    const template = allTemplates.find(t => t.id == currentEditingTemplateId);
    if (template) {
      initialContent = template.html_content || '';
    }
  }

  // Bind change events to name and award inputs for real-time preview and auto-save
  const nameInput = document.getElementById('builder-tpl-name');
  const awardInput = document.getElementById('builder-tpl-award');
  if (nameInput && !nameInput.dataset.autosaveBound) {
    nameInput.dataset.autosaveBound = 'true';
    nameInput.addEventListener('input', () => {
      updateCertificatePreview();
      triggerAutoSave();
    });
  }
  if (awardInput && !awardInput.dataset.autosaveBound) {
    awardInput.dataset.autosaveBound = 'true';
    awardInput.addEventListener('input', () => {
      updateCertificatePreview();
      triggerAutoSave();
    });
  }

  if (mode === 'design') {
    document.getElementById('editor-container-design').style.display = 'flex';
    document.getElementById('editor-container-code').style.display = 'none';
    if (!tinymceEditor) {
      tinymce.init({
        selector: '#tinymce-editor',
        height: '100%',
        menubar: false,
        plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount',
        toolbar: 'undo redo | blocks | bold italic forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | image table code',
        setup: function(editor) {
          tinymceEditor = editor;
          editor.on('Change KeyUp', function() {
            updateCertificatePreview();
            triggerAutoSave();
          });
        }
      });
      setTimeout(() => {
        tinymceEditor.setContent(initialContent || '');
        updateCertificatePreview();
      }, 500);
    } else {
      tinymceEditor.setContent(initialContent || '');
      updateCertificatePreview();
    }
  } else {
    document.getElementById('editor-container-design').style.display = 'none';
    document.getElementById('editor-container-code').style.display = 'flex';
    if (!codemirrorEditor) {
      codemirrorEditor = CodeMirror(document.getElementById('codemirror-editor'), {
        mode: 'htmlmixed',
        theme: 'monokai',
        lineNumbers: true,
        lineWrapping: true,
        value: initialContent || '<div style="padding:40px; font-family:sans-serif; text-align:center;">\n  <h1 style="color:#059669;">Certificate of Achievement</h1>\n  <p>This is presented to</p>\n  <h2 style="color:#1e293b;">{{NAME}}</h2>\n</div>'
      });
      codemirrorEditor.on('change', function() {
        updateCertificatePreview();
        triggerAutoSave();
      });
      setTimeout(updateCertificatePreview, 100);
    } else {
      codemirrorEditor.setValue(initialContent || '<div style="padding:40px; font-family:sans-serif; text-align:center;">\n  <h1 style="color:#059669;">Certificate of Achievement</h1>\n  <p>This is presented to</p>\n  <h2 style="color:#1e293b;">{{NAME}}</h2>\n</div>');
      updateCertificatePreview();
    }
  }
  
  // Set default view to desktop
  setBuilderPreviewMode('desktop');
}

function closeTemplateBuilder() {
  document.getElementById('template-builder-overlay').style.display = 'none';
}

function insertBuilderVariable(variable) {
  if (currentBuilderMode === 'design' && tinymceEditor) {
    tinymceEditor.insertContent(variable);
  } else if (currentBuilderMode === 'code' && codemirrorEditor) {
    codemirrorEditor.replaceSelection(variable);
  }
  document.getElementById('builder-var-dropdown').classList.remove('show');
  updateCertificatePreview();
}

function setBuilderPreviewMode(mode) {
  // Mode toggling logic removed, single responsive mode enforced.
}

function updatePreviewScale() {
  const wrapper = document.getElementById('preview-wrapper');
  const scaleContainer = document.getElementById('preview-scale-container');
  if (!wrapper || !scaleContainer) return;
  const container = scaleContainer.parentElement;

  const availableWidth = container.clientWidth - 48;
  const availableHeight = container.clientHeight - 100;
  // Use standard certificate size (A4 Landscape 1123x794)
  const baseWidth = 1123;
  const baseHeight = 794;
  const scaleX = availableWidth / baseWidth;
  const scaleY = availableHeight / baseHeight;
  const scale = Math.max(0.3, Math.min(scaleX, scaleY, 1));

  wrapper.style.transform = `scale(${scale})`;
  scaleContainer.style.width = `${baseWidth * scale}px`;
  scaleContainer.style.height = `${baseHeight * scale}px`;
  wrapper.style.width = `${baseWidth}px`;
  wrapper.style.height = `${baseHeight}px`;
}

window.addEventListener('resize', () => {
  if (document.getElementById('template-builder-overlay') && document.getElementById('template-builder-overlay').style.display === 'flex') {
    updatePreviewScale();
  }
});

function updateCertificatePreview() {
  let content = '';
  if (currentBuilderMode === 'design' && tinymceEditor) {
    content = tinymceEditor.getContent();
  } else if (currentBuilderMode === 'code' && codemirrorEditor) {
    content = codemirrorEditor.getValue();
  }
  
  // Replace variables with dummy data
  content = content.replace(/{{NAME}}/g, 'Priya Sharma')
                   .replace(/{{EMAIL}}/g, 'priya@example.com')
                   .replace(/{{ZONE}}/g, 'North Zone')
                   .replace(/{{DATE}}/g, new Date().toLocaleDateString())
                   .replace(/{{ISSUER}}/g, 'Eco Warrior Admin')
                   .replace(/{{CERTIFICATE_ID}}/g, 'CERT-2026-001')
                   .replace(/{{CERTIFICATE_TYPE}}/g, 'Achievement')
                   .replace(/{{AWARD_TYPE}}/g, document.getElementById('builder-tpl-award').value || 'Outstanding Service')
                   .replace(/{{ORGANIZATION}}/g, 'Eco Warrior Foundation');
                   
  const iframe = document.getElementById('live-preview-frame');
  if(!iframe) return;
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><style>body{margin:0;padding:0;box-sizing:border-box;} *{box-sizing:inherit;}</style></head><body>' + content + '</body></html>');
  doc.close();
}

// Global click to close var dropdown
document.addEventListener('click', function(e) {
  if (!e.target.closest('.builder-var-toolbar')) {
    const dropdown = document.getElementById('builder-var-dropdown');
    if (dropdown) dropdown.classList.remove('show');
  }
});

async function saveTemplateBuilder() {
  const name = document.getElementById('builder-tpl-name').value;
  const awardType = document.getElementById('builder-tpl-award').value;
  const saveBtn = document.getElementById('btn-save-template');
  
  if (!name || !awardType) {
    return showToast('⚠️ Fill Template Name and Award Type');
  }
  
  let htmlContent = '';
  if (currentBuilderMode === 'design' && tinymceEditor) {
    htmlContent = tinymceEditor.getContent();
  } else if (currentBuilderMode === 'code' && codemirrorEditor) {
    htmlContent = codemirrorEditor.getValue();
  }
  
  if (!htmlContent) {
    return showToast('⚠️ Template content cannot be empty');
  }
  
  // Disable button to prevent duplicates
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ph-duotone ph-spinner animate-spin"></i> Saving...';
  }
  
  const formData = new FormData();
  formData.append('admin_password', currentAdminPassword);
  formData.append('name', name);
  formData.append('award_type', awardType);
  formData.append('mode', currentBuilderMode);
  formData.append('html_content', htmlContent);
  // Default CSS for now, user can embed it in HTML in code editor
  formData.append('css_content', ''); 
  
  if (currentEditingTemplateId) {
    formData.append('id', currentEditingTemplateId);
  }
  
  const endpoint = currentEditingTemplateId ? `${API_URL}/api/certificates/update_template.php` : `${API_URL}/api/certificates/create_template.php`;
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Template Saved!');
      closeTemplateBuilder();
      fetchTemplates(true); // Force refresh
    } else {
      showToast('❌ Failed: ' + data.message);
    }
  } catch (e) {
    console.error(e);
    showToast('❌ Error saving template');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save Template';
    }
  }
}

let autoSaveTimeout = null;

function triggerAutoSave() {
  const name = document.getElementById('builder-tpl-name').value.trim();
  const awardType = document.getElementById('builder-tpl-award').value.trim();
  
  if (!currentEditingTemplateId && (!name || !awardType)) return; // Only auto-save new templates if basic fields are set
  
  const statusEl = document.getElementById('template-save-status');
  if (statusEl) {
    statusEl.innerText = 'Saving...';
    statusEl.style.display = 'inline';
  }
  
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    performAutoSave();
  }, 1000);
}

async function performAutoSave() {
  const name = document.getElementById('builder-tpl-name').value.trim();
  const awardType = document.getElementById('builder-tpl-award').value.trim();
  
  if (!name || !awardType) return;
  
  let htmlContent = '';
  if (currentBuilderMode === 'design' && tinymceEditor) {
    htmlContent = tinymceEditor.getContent();
  } else if (currentBuilderMode === 'code' && codemirrorEditor) {
    htmlContent = codemirrorEditor.getValue();
  }
  
  if (!htmlContent) return;
  
  const formData = new FormData();
  formData.append('admin_password', currentAdminPassword);
  formData.append('name', name);
  formData.append('award_type', awardType);
  formData.append('mode', currentBuilderMode);
  formData.append('html_content', htmlContent);
  formData.append('css_content', ''); 
  
  if (currentEditingTemplateId) {
    formData.append('id', currentEditingTemplateId);
  }
  
  const endpoint = currentEditingTemplateId 
    ? `${API_URL}/api/certificates/update_template.php` 
    : `${API_URL}/api/certificates/create_template.php`;
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    const statusEl = document.getElementById('template-save-status');
    if (data.success) {
      if (statusEl) statusEl.innerText = 'Saved ✓';
      
      // If a new template was created, save its ID
      if (!currentEditingTemplateId && data.id) {
        currentEditingTemplateId = data.id;
      }
      
      if (typeof fetchTemplates === 'function') fetchTemplates(); 
    } else {
      if (statusEl) statusEl.innerText = 'Error saving';
    }
  } catch (e) {
    console.error(e);
    const statusEl = document.getElementById('template-save-status');
    if (statusEl) statusEl.innerText = 'Error saving';
  }
}

function editTemplate(id) {
  const template = allTemplates.find(t => t.id == id);
  if (!template) return;
  
  currentEditingTemplateId = id;
  
  const previewOverlay = document.getElementById('template-preview-overlay');
  if (previewOverlay) previewOverlay.classList.remove('open');
  
  document.getElementById('builder-tpl-name').value = template.name;
  document.getElementById('builder-tpl-award').value = template.award_type;

  document.getElementById('template-mode-selector-overlay').classList.add('open');
}

function openTemplatePreview(id) {
  const template = allTemplates.find(t => t.id == id);
  if (!template) return;

  const overlay = document.getElementById('template-preview-overlay');
  const iframe = document.getElementById('full-preview-frame');
  const btnEdit = document.getElementById('btn-preview-edit');
  const btnDelete = document.getElementById('btn-preview-delete');

  let content = template.html_content || `
        <div style="width:100%; height:100%; background:${template.bg_gradient || '#f8fafc'}; padding:40px; box-sizing:border-box; position:relative; font-family:'Georgia', serif; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.0.3/src/duotone/style.css">
          <div style="font-size:48px; color:${template.primary_color || '#1e293b'}; margin-bottom:10px;"><i class="${template.icon_class || 'ph-duotone ph-certificate'}"></i></div>
          <h1 style="font-size:36px; color:${template.primary_color || '#1e293b'}; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:2px;">${template.name || 'Certificate'}</h1>
          <div style="width:100px; height:2px; background:${template.primary_color || '#1e293b'}; margin:0 auto 20px auto;"></div>
          <p style="font-size:16px; color:#475569; font-family:sans-serif; margin-bottom:5px;">This is presented to</p>
          <h2 style="font-size:28px; color:#0f172a; margin:0 0 20px 0; font-style:italic;">{{NAME}}</h2>
          <p style="font-size:16px; color:#475569; font-family:sans-serif;">For outstanding contribution in</p>
          <h3 style="font-size:20px; color:${template.primary_color || '#1e293b'}; margin:10px 0 30px 0; text-transform:uppercase;">{{AWARD_TYPE}}</h3>
        </div>`;

  // Inject global CSS variables to ensure correct rendering inside the iframe sandbox
  const variablesStyle = `
    <style>
      :root {
        --gold: #d97706;
        --blue: #3b82f6;
        --purple: #8b5cf6;
        --acc2: #16a34a;
        --t3: #6b7280;
        --text3: #6b7280;
        --g900: #0a3d1f;
        --g800: #0f5c2e;
        --g700: #147a3d;
        --g600: #1a9a4e;
        --g500: #1fb960;
        --g400: #2ecc71;
        --g300: #5dd88a;
        --g200: #8fe5ac;
        --g100: #c4f0d5;
        --g50: #edfaf2;
        --teal: #00b4a0;
        --teal-l: #e0f7f5;
        --amber: #f59e0b;
        --amber-l: #fef3c7;
        --red: #ef4444;
        --red-l: #fee2e2;
        --blue-l: #eff6ff;
        --brown: #92400e;
        --brown-l: #fef3c7;
        --bg: #f9fafb;
        --bg2: #ffffff;
        --bg3: #f0fdf4;
        --text: #111827;
        --text2: #374151;
        --border: #e5e7eb;
        --border2: #d1fae5;
      }
    </style>
  `;

  if (content.includes('</head>')) {
    content = content.replace('</head>', variablesStyle + '</head>');
  } else {
    content = variablesStyle + content;
  }

  content = content.replace(/{{NAME}}/g, 'Recipient Name')
                   .replace(/{{EMAIL}}/g, 'recipient@example.com')
                   .replace(/{{ZONE}}/g, 'Sample Zone')
                   .replace(/{{DATE}}/g, new Date().toLocaleDateString())
                   .replace(/{{ISSUER}}/g, 'Authorized Person')
                   .replace(/{{CERTIFICATE_ID}}/g, 'CERT-XXXX-XXXX')
                   .replace(/{{CERTIFICATE_TYPE}}/g, 'Certificate Type')
                   .replace(/{{AWARD_TYPE}}/g, template.award_type || 'Award Type')
                   .replace(/{{ORGANIZATION}}/g, 'Organization Name');

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#e2e8f0;font-family:sans-serif;overflow:hidden;} .cert-scaler{width:1123px;height:794px;transform-origin:center center;} .cert-container{width:100%;height:100%;box-shadow:0 10px 40px rgba(0,0,0,0.1);background:#fff;overflow:hidden;} *{box-sizing:inherit;}</style></head><body><div class="cert-scaler" id="cert-scaler"><div class="cert-container">' + content + '</div></div><script>function fit(){var s=document.getElementById("cert-scaler");var w=window.innerWidth*0.95;var h=window.innerHeight*0.95;var scale=Math.min(w/1123, h/794);s.style.transform="scale("+scale+")";} window.onload=fit;window.onresize=fit;</script></body></html>');
  doc.close();

  const btnDefault = document.getElementById('btn-preview-default');
  if (btnEdit) btnEdit.style.display = 'flex';
  if (btnDelete) btnDelete.style.display = 'flex';
  if (btnDefault) {
    btnDefault.style.display = 'flex';
    if (template.is_default == 1) {
      btnDefault.innerHTML = '<i class="ph-bold ph-check-circle"></i> Default ✓';
      btnDefault.style.background = '#f59e0b';
      btnDefault.style.color = '#fff';
      btnDefault.style.borderColor = '#d97706';
      btnDefault.disabled = true;
      btnDefault.style.cursor = 'default';
      btnDefault.onclick = null;
    } else {
      btnDefault.innerHTML = '<i class="ph-bold ph-star"></i> Set Default';
      btnDefault.style.background = '#fff';
      btnDefault.style.color = '#d97706';
      btnDefault.style.borderColor = '#fde68a';
      btnDefault.disabled = false;
      btnDefault.style.cursor = 'pointer';
      btnDefault.onclick = () => setDefaultTemplate(id);
    }
  }

  btnEdit.onclick = () => editTemplate(id);
  btnDelete.onclick = () => deleteTemplate(id);

  overlay.classList.add('open');
}

function setDefaultTemplate(id) {
  // Optimistic UI updates
  allTemplates.forEach(t => t.is_default = (t.id == id ? 1 : 0));
  
  const btnDefault = document.getElementById('btn-preview-default');
  if (btnDefault) {
    btnDefault.innerHTML = '<i class="ph-bold ph-check-circle"></i> Default ✓';
    btnDefault.style.background = '#f59e0b';
    btnDefault.style.color = '#fff';
    btnDefault.style.borderColor = '#d97706';
    btnDefault.disabled = true;
    btnDefault.style.cursor = 'default';
    btnDefault.onclick = null;
  }
  
  allTemplates.sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const container = document.getElementById('cert-templates-container');
  if (container) renderTemplatesUI(container, allTemplates);

  showToast('✅ Default template set successfully!');

  const formData = new FormData();
  formData.append('admin_password', currentAdminPassword);
  formData.append('id', id);

  fetch(`${API_URL}/api/certificates/set_default_template.php`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) throw new Error('API failed');
  })
  .catch(err => {
    console.error(err);
    showToast('❌ Failed to set default on server');
    if (typeof fetchTemplates === 'function') fetchTemplates(true);
  });
}

function showCustomConfirm(title, message, onAccept, acceptText = 'Yes, delete it', isDanger = true) {
  const overlay = document.getElementById('custom-confirm-overlay');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const acceptBtn = document.getElementById('btn-confirm-accept');
  const iconEl = overlay ? overlay.querySelector('i') : null;
  const iconContainer = iconEl ? iconEl.parentElement : null;
  
  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;
  
  if (acceptBtn) {
    acceptBtn.innerText = acceptText;
    if (isDanger) {
      acceptBtn.style.background = '#ef4444';
      acceptBtn.style.borderColor = '#ef4444';
      acceptBtn.style.color = '#fff';
    } else {
      acceptBtn.style.background = '#16a34a';
      acceptBtn.style.borderColor = '#16a34a';
      acceptBtn.style.color = '#fff';
    }
    
    acceptBtn.onclick = () => {
      if (overlay) overlay.classList.remove('open');
      if (typeof onAccept === 'function') onAccept();
    };
  }
  
  if (iconEl && iconContainer) {
    if (isDanger) {
      iconEl.className = 'ph-duotone ph-warning-octagon';
      iconEl.style.color = '#ef4444';
      iconContainer.style.background = '#fef2f2';
      iconContainer.style.borderColor = '#fca5a5';
    } else {
      iconEl.className = 'ph-duotone ph-star';
      iconEl.style.color = '#eab308';
      iconContainer.style.background = '#fef9c3';
      iconContainer.style.borderColor = '#fde047';
    }
  }
  
  if (overlay) overlay.classList.add('open');
}

function deleteTemplate(id) {
  const template = allTemplates.find(t => t.id == id);
  if (!template) return;

  const msg = template.is_default == 1 
    ? "This is the default template. Please assign another template as default before deleting. Do you still want to delete it?"
    : "Are you sure you want to permanently delete this certificate template, or have you changed your mind?";

  showCustomConfirm("Delete Template?", msg, () => {

  const formData = new FormData();
  formData.append('admin_password', currentAdminPassword);
  formData.append('id', id);

  fetch(`${API_URL}/api/certificates/delete_template.php`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('✅ Certificate Template deleted successfully.');
      document.getElementById('template-preview-overlay').classList.remove('open');
      if (typeof fetchTemplates === 'function') fetchTemplates();
    } else {
      showToast('❌ Failed: ' + data.message);
    }
  })
  .catch(err => {
    console.error(err);
    showToast('❌ Error deleting template');
  });
});
}

let templatesFetched = false;

async function fetchTemplates(force = false) {
  const container = document.getElementById('cert-templates-container');
  if (!container) return;
  
  if (!force && templatesFetched && allTemplates.length > 0) {
    renderTemplatesUI(container, allTemplates);
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/certificates/get_templates.php?t=${new Date().getTime()}`);
    const data = await res.json();
    if (data.success && data.templates.length > 0) {
      allTemplates = data.templates.sort((a, b) => Number(b.is_default) - Number(a.is_default));
      templatesFetched = true;
      renderTemplatesUI(container, allTemplates);
    } else {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);">No templates found. Create one to get started!</div>';
    }
  } catch (e) {
    console.error("Error fetching templates", e);
  }
}

function renderTemplatesUI(container, templates) {
  const dynamicCss = `
    <style>
      .template-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 12px; }
      .template-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15); border-color: #94a3b8 !important; z-index: 10; }
      .template-card .preview-box {
        width: 100%;
        aspect-ratio: 1123 / 449; /* Top 40% aspect ratio of 1123x794 certificate */
        overflow: hidden;
        position: relative;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
    </style>
  `;

  const htmlContent = templates.map(t => {
    const defaultBadge = t.is_default == 1 ? `
      <div style="position:absolute;top:12px;right:12px;z-index:10;display:flex;align-items:center;gap:4px;background:rgba(245,158,11,0.15);backdrop-filter:blur(4px);border:1px solid rgba(245,158,11,0.3);color:#d97706;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <i class="ph-fill ph-star"></i> Default
      </div>` : '';
    
    let html = t.html_content || `
      <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.0.3/src/duotone/style.css">
        <style>body{margin:0;padding:0;}</style>
      </head>
      <body>
        <div style="width:100%; height:100vh; background:${t.bg_gradient || '#f8fafc'}; padding:40px; box-sizing:border-box; position:relative; font-family:'Georgia', serif; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <div style="font-size:48px; color:${t.primary_color || '#1e293b'}; margin-bottom:10px;"><i class="${t.icon_class || 'ph-duotone ph-certificate'}"></i></div>
          <h1 style="font-size:36px; color:${t.primary_color || '#1e293b'}; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:2px;">${t.name || 'Certificate'}</h1>
          <div style="width:100px; height:2px; background:${t.primary_color || '#1e293b'}; margin:0 auto 20px auto;"></div>
          <p style="font-size:16px; color:#475569; font-family:sans-serif; margin-bottom:5px;">This is presented to</p>
          <h2 style="font-size:28px; color:#0f172a; margin:0 0 20px 0; font-style:italic;">{{NAME}}</h2>
          <p style="font-size:16px; color:#475569; font-family:sans-serif;">For outstanding contribution in</p>
          <h3 style="font-size:20px; color:${t.primary_color || '#1e293b'}; margin:10px 0 30px 0; text-transform:uppercase;">{{AWARD_TYPE}}</h3>
        </div>
      </body>
      </html>`;
    
    // Inject global CSS variables to ensure correct rendering inside the iframe sandbox
    const variablesStyle = `
      <style>
        :root {
          --gold: #d97706;
          --blue: #3b82f6;
          --purple: #8b5cf6;
          --acc2: #16a34a;
          --t3: #6b7280;
          --text3: #6b7280;
          --g900: #0a3d1f;
          --g800: #0f5c2e;
          --g700: #147a3d;
          --g600: #1a9a4e;
          --g500: #1fb960;
          --g400: #2ecc71;
          --g300: #5dd88a;
          --g200: #8fe5ac;
          --g100: #c4f0d5;
          --g50: #edfaf2;
          --teal: #00b4a0;
          --teal-l: #e0f7f5;
          --amber: #f59e0b;
          --amber-l: #fef3c7;
          --red: #ef4444;
          --red-l: #fee2e2;
          --blue-l: #eff6ff;
          --brown: #92400e;
          --brown-l: #fef3c7;
          --bg: #f9fafb;
          --bg2: #ffffff;
          --bg3: #f0fdf4;
          --text: #111827;
          --text2: #374151;
          --border: #e5e7eb;
          --border2: #d1fae5;
        }
      </style>
    `;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', variablesStyle + '</head>');
    } else {
      html = variablesStyle + html;
    }

    html = html.replace(/{{NAME}}/g, 'Recipient Name')
               .replace(/{{AWARD_TYPE}}/g, t.award_type || 'Award Type')
               .replace(/{{DATE}}/g, new Date().toLocaleDateString())
               .replace(/{{ISSUER}}/g, 'Issuing Authority')
               .replace(/{{ORGANIZATION}}/g, 'Organization');

    const scaleScript = '<style>body{margin:0;padding:0;overflow:hidden;} #cert-scaler{width:1123px;height:794px;transform-origin:top left;}</style><script>function fit(){var s=document.getElementById("cert-scaler");if(s){s.style.transform="scale("+(window.innerWidth/1123)+")";}} window.onload=fit;window.onresize=fit;</script>';
    
    if (html.includes('<body') && html.includes('</body>')) {
      html = html.replace(/(<body[^>]*>)/i, '$1<div id="cert-scaler">');
      html = html.replace(/<\/body>/i, '</div>' + scaleScript + '</body>');
    } else {
      html = '<div id="cert-scaler">' + html + '</div>' + scaleScript;
    }

    let encodedHtml = html.replace(/"/g, '&quot;');
    
    // Render dynamic template card with responsive aspect-ratio cropped top 40% preview
    return `
      <div class="admin-widget template-card group" onclick="openTemplatePreview(${t.id})" style="overflow:hidden;border:1px solid #e2e8f0;position:relative;background:#fff;cursor:pointer;">
        ${defaultBadge}
        <div class="preview-box">
           <iframe srcdoc="${encodedHtml}" style="width:100%;height:100%;border:none;pointer-events:none;" scrolling="no" tabindex="-1"></iframe>
        </div>
        <div style="padding:16px;">
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">${t.name}</div>
          <div style="font-size:12px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
             <span style="display:flex;align-items:center;gap:4px;"><i class="ph-duotone ph-tag"></i> ${t.award_type}</span>
             <span style="font-weight:600;background:#f1f5f9;color:#475569;padding:3px 8px;border-radius:12px;">${t.usage_count || 0} Uses</span>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = dynamicCss + htmlContent;
}

async function loadTemplateSettings() {
  try {
    const res = await fetch(`${API_URL}/api/certificates/get_settings.php`);
    const data = await res.json();
    if (data.success && data.settings) {
      const autoSelect = data.settings['auto_select'] === '1';
      const modIssue = data.settings['mod_issue'] === '1';
      
      const elAuto = document.getElementById('setting-auto-select');
      if (elAuto) {
        elAuto.checked = autoSelect;
        elAuto.nextElementSibling.style.background = autoSelect ? '#16a34a' : '#e2e8f0';
        elAuto.nextElementSibling.firstElementChild.style.transform = autoSelect ? 'translateX(16px)' : 'translateX(0)';
      }
      
      const elMod = document.getElementById('setting-mod-issue');
      if (elMod) {
        elMod.checked = modIssue;
        elMod.nextElementSibling.style.background = modIssue ? '#16a34a' : '#e2e8f0';
        elMod.nextElementSibling.firstElementChild.style.transform = modIssue ? 'translateX(16px)' : 'translateX(0)';
      }
    }
  } catch (e) {
    console.error("Error loading template settings", e);
  }
}

async function saveTemplateSetting(key, checkbox) {
  const value = checkbox.checked ? '1' : '0';
  
  // Update UI manually first
  checkbox.nextElementSibling.style.background = checkbox.checked ? '#16a34a' : '#e2e8f0';
  checkbox.nextElementSibling.firstElementChild.style.transform = checkbox.checked ? 'translateX(16px)' : 'translateX(0)';
  
  const formData = new FormData();
  formData.append('admin_password', currentAdminPassword);
  formData.append('setting_key', key);
  formData.append('setting_value', value);
  
  try {
    const res = await fetch(`${API_URL}/api/certificates/update_settings.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) {
      showToast('❌ Failed to update setting: ' + data.message);
      // Revert UI if failed
      checkbox.checked = !checkbox.checked;
      checkbox.nextElementSibling.style.background = checkbox.checked ? '#16a34a' : '#e2e8f0';
      checkbox.nextElementSibling.firstElementChild.style.transform = checkbox.checked ? 'translateX(16px)' : 'translateX(0)';
    }
  } catch (e) {
    console.error(e);
    showToast('❌ Error saving setting');
    // Revert UI if failed
    checkbox.checked = !checkbox.checked;
    checkbox.nextElementSibling.style.background = checkbox.checked ? '#16a34a' : '#e2e8f0';
    checkbox.nextElementSibling.firstElementChild.style.transform = checkbox.checked ? 'translateX(16px)' : 'translateX(0)';
  }
}

// ── ALERT MANAGEMENT SYSTEM ──
function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let alertState = {
  allAlerts: [],
  intervalId: null
};

async function fetchAlerts(force = false) {
  try {
    const res = await adminFetch(`${API_URL}/api/alerts.php`);
    const data = await res.json();
    if (data.success) {
      alertState.allAlerts = data.alerts;
      renderAlerts();
      updateDashboardAlertStats();
      if (typeof renderAlertWidgets === 'function') renderAlertWidgets();
    }
  } catch (err) {
    console.error("Failed to fetch alerts:", err);
  }
}

function renderAlerts() {
  const container = document.getElementById('active-alerts-container');
  const historyContainer = document.getElementById('alert-history-container');
  if (!container || !historyContainer) return;

  const severityFilter = document.getElementById('alert-filter-severity').value;
  const typeFilter = document.getElementById('alert-filter-type').value;
  const statusFilter = document.getElementById('alert-filter-status').value;
  const searchVal = document.getElementById('alert-search-input').value.toLowerCase().trim();

  // Filter alerts
  const filtered = alertState.allAlerts.filter(alert => {
    // Severity
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    // Type
    if (typeFilter !== 'all' && alert.alert_type !== typeFilter) return false;
    // Status
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    // Search
    if (searchVal) {
      const title = (alert.title || '').toLowerCase();
      const desc = (alert.description || '').toLowerCase();
      const src = (alert.source || '').toLowerCase();
      if (!title.includes(searchVal) && !desc.includes(searchVal) && !src.includes(searchVal)) return false;
    }
    return true;
  });

  const activeAlerts = filtered.filter(a => a.status === 'Active' || a.status === 'Investigating');
  const historyAlerts = filtered.filter(a => a.status === 'Resolved' || a.status === 'Dismissed');

  document.getElementById('active-alerts-count').textContent = activeAlerts.length;

  // Render active
  if (activeAlerts.length === 0) {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; background:#fff; border:1px dashed var(--border); border-radius:12px; color:var(--text3);">
        <i class="ph-duotone ph-shield-check" style="font-size:48px; color:var(--primary); margin-bottom:12px;"></i>
        <div style="font-family:'Outfit'; font-weight:700; color:var(--text)">All Systems Clear</div>
        <div style="font-size:12px; margin-top:4px;">No active alerts require attention.</div>
      </div>`;
  } else {
    container.innerHTML = activeAlerts.map(alert => renderAlertCard(alert)).join('');
  }

  // Render history
  if (historyAlerts.length === 0) {
    historyContainer.innerHTML = '<div style="font-size:12px; color:var(--text3); text-align:center; padding:20px;">No alert history found.</div>';
  } else {
    historyContainer.innerHTML = historyAlerts.map(alert => renderHistoryCard(alert)).join('');
  }
}

function getSeverityColor(sev) {
  if (sev === 'Critical') return '#ef4444';
  if (sev === 'High') return '#f97316';
  return '#eab308'; // Medium
}

function renderAlertCard(alert) {
  const borderCol = getSeverityColor(alert.severity);
  const typeBadgeBg = alert.alert_type === 'security' ? '#fef2f2' : '#fff7ed';
  const typeBadgeCol = alert.alert_type === 'security' ? '#ef4444' : '#f97316';
  
  // Escalation rule badge for critical alerts rendered directly from DB escalation_level
  let escalationHtml = '';
  if (alert.severity === 'Critical' && alert.status === 'Active') {
    const level = alert.escalation_level || 'Super Admin Notified';
    if (level === 'Super Admin Notified') {
      escalationHtml = `<span style="font-size:11px; font-weight:700; color:#ef4444; background:#fef2f2; border:1px solid #fca5a5; padding:3px 8px; border-radius:4px; margin-left:8px;">🚨 Super Admin Notified</span>`;
    } else if (level === 'Escalated to Security Team') {
      escalationHtml = `<span style="font-size:11px; font-weight:700; color:#b91c1c; background:#fee2e2; border:1px solid #fca5a5; padding:3px 8px; border-radius:4px; margin-left:8px;">⚠️ Escalated to Security Team</span>`;
    } else if (level === 'Escalated to Platform Owner') {
      escalationHtml = `<span style="font-size:11px; font-weight:700; color:#7f1d1d; background:#fecaca; border:1px solid #f87171; padding:3px 8px; border-radius:4px; margin-left:8px;">🔥 Escalated to Platform Owner</span>`;
    } else if (level === 'EMERGENCY UNRESOLVED') {
      escalationHtml = `<span style="font-size:11px; font-weight:700; color:#fff; background:#ef4444; border:1px solid #dc2626; padding:3px 8px; border-radius:4px; margin-left:8px; animation: pulse 1s infinite;">🚨 EMERGENCY UNRESOLVED</span>`;
    } else {
      escalationHtml = `<span style="font-size:11px; font-weight:700; color:#ef4444; background:#fef2f2; border:1px solid #fca5a5; padding:3px 8px; border-radius:4px; margin-left:8px;">🚨 ${escapeHTML(level)}</span>`;
    }
  }

  const isSuperAdmin = sessionStorage.getItem('adminRole') === 'Super Admin';

  // Action buttons based on type with Super Admin checks
  let actionsHtml = '';
  if (alert.alert_type === 'security') {
    actionsHtml = `
      <button class="action-btn" style="padding:8px 16px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;" onclick="openReviewSessionsModal()">Review Sessions</button>
      ${isSuperAdmin 
        ? `<button class="action-btn" style="padding:8px 16px; background:#fff; color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;" onclick="openBlockIpModal('${escapeHTML(alert.source)}')">Block IP</button>` 
        : `<button class="action-btn" style="padding:8px 16px; background:#f3f4f6; color:#9ca3af; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-weight:700; cursor:not-allowed;" disabled title="Super Admin privileges required">Block IP</button>`}
    `;
  } else {
    actionsHtml = `
      ${isSuperAdmin 
        ? `<button class="action-btn" style="padding:8px 16px; background:#fff7ed; color:#f97316; border:1px solid #fdba74; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;" onclick="triggerSyncRetry()">Retry Sync</button>` 
        : `<button class="action-btn" style="padding:8px 16px; background:#f3f4f6; color:#9ca3af; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-weight:700; cursor:not-allowed;" disabled title="Super Admin privileges required">Retry Sync</button>`}
      ${isSuperAdmin 
        ? `<button class="action-btn" style="padding:8px 16px; background:#fff; color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;" onclick="openLogViewerModal()">View Logs</button>` 
        : `<button class="action-btn" style="padding:8px 16px; background:#f3f4f6; color:#9ca3af; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-weight:700; cursor:not-allowed;" disabled title="Super Admin privileges required">View Logs</button>`}
    `;
  }

  return `
    <div class="admin-alert-card alert-card-timer" data-created="${alert.created_at}" style="background:#fff; border:1px solid var(--border); border-left:4px solid ${borderCol}; border-radius:12px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="background:${typeBadgeBg}; color:${typeBadgeCol}; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">${alert.alert_type}</span>
          <span style="background:${borderCol}15; color:${borderCol}; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:800; text-transform:uppercase;">${alert.severity}</span>
          ${escalationHtml}
          <h3 style="font-size:16px; font-weight:700; color:var(--text); font-family:'Outfit',sans-serif; margin:0; width:100%; margin-top:6px;">${escapeHTML(alert.title)}</h3>
        </div>
        <span class="countdown-display" style="font-size:12px; color:var(--text3); font-weight:600;"><i class="ph-duotone ph-clock" style="position:relative;top:2px;"></i> Loading...</span>
      </div>
      
      <div style="font-size:13px; color:var(--text2); margin-bottom:20px; line-height:1.5;">
        ${escapeHTML(alert.description)}
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        ${actionsHtml}
        ${isSuperAdmin 
          ? `<button class="action-btn" style="padding:8px 16px; background:transparent; color:var(--text3); border:none; font-size:13px; font-weight:600; cursor:pointer; margin-left:auto;" onclick="updateAlertStatus(${alert.id}, 'Dismissed')">Dismiss</button>` 
          : `<button class="action-btn" style="padding:8px 16px; background:transparent; color:#d1d5db; border:none; font-size:13px; font-weight:600; cursor:not-allowed; margin-left:auto;" disabled title="Super Admin privileges required">Dismiss</button>`}
      </div>
    </div>`;
}

function renderHistoryCard(alert) {
  const typeBadgeCol = alert.alert_type === 'security' ? '#ef4444' : '#f97316';
  const statusColor = alert.status === 'Resolved' ? '#16a34a' : '#64748b';
  
  return `
    <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:12px; font-size:12px; box-shadow:var(--shadow-sm);">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="font-weight:800; color:${typeBadgeCol}; text-transform:uppercase; font-size:10px;">${alert.alert_type}</span>
        <span style="color:${statusColor}; font-weight:700; text-transform:uppercase; font-size:10px;">● ${escapeHTML(alert.status)}</span>
      </div>
      <div style="font-weight:700; color:var(--text); margin-bottom:4px;">${escapeHTML(alert.title)}</div>
      <div style="color:var(--text3); font-size:11px; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Resolved by: ${escapeHTML(alert.resolved_by || 'System')}</div>
      <div style="font-size:10px; color:var(--text3); display:flex; justify-content:space-between;">
        <span>${new Date(alert.created_at).toLocaleDateString()}</span>
        <span>resolved: ${adminTimeAgo(alert.resolved_at)}</span>
      </div>
    </div>`;
}

function updateAlertsCountdown() {
  document.querySelectorAll('.alert-card-timer').forEach(card => {
    const createdStr = card.getAttribute('data-created');
    const created = new Date(createdStr);
    const diffMs = new Date() - created;
    const diffSecs = Math.floor(diffMs / 1000);
    
    let timeStr = '';
    if (diffSecs < 60) timeStr = `${diffSecs}s ago`;
    else if (diffSecs < 3600) timeStr = `${Math.floor(diffSecs / 60)}m ${diffSecs % 60}s ago`;
    else timeStr = `${Math.floor(diffSecs / 3600)}h ${Math.floor((diffSecs % 3600) / 60)}m ago`;
    
    const display = card.querySelector('.countdown-display');
    if (display) display.innerHTML = `<i class="ph-duotone ph-clock" style="position:relative;top:2px;"></i> ${timeStr}`;
  });
}

async function updateAlertStatus(alertId, status) {
  try {
    const formData = new FormData();
    formData.append('id', alertId);
    formData.append('status', status);
    formData.append('resolved_by', sessionStorage.getItem('adminEmail') || 'Admin');

    const res = await adminFetch(`${API_URL}/api/alerts.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Alert marked as ${status}`);
      fetchAlerts(true);
    } else {
      showToast(`Failed to update alert: ${data.message}`);
    }
  } catch (err) {
    console.error("Alert status update failed:", err);
  }
}

// ── REVIEW SESSIONS MODAL LOGIC ──
async function openReviewSessionsModal() {
  const tbody = document.getElementById('sessions-modal-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">⏳ Loading sessions...</td></tr>';
  document.getElementById('review-sessions-modal-overlay').classList.add('open');
  
  try {
    const res = await adminFetch(`${API_URL}/api/login_sessions.php`);
    const data = await res.json();
    if (data.success) {
      if (data.sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No sessions logged.</td></tr>';
        return;
      }
      const isSuperAdmin = sessionStorage.getItem('adminRole') === 'Super Admin';
      tbody.innerHTML = data.sessions.map(s => {
        let actionBtn = '';
        if (s.status === 'Active') {
          if (isSuperAdmin) {
            actionBtn = `
              <button class="action-btn" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:4px 8px; font-size:11px; margin-right:4px;" onclick="updateSessionStatus(${s.id}, 'terminate')">Terminate</button>
              <button class="action-btn" style="background:#fef3c7; color:#d97706; border:1px solid #fde68a; padding:4px 8px; font-size:11px; margin-right:4px;" onclick="updateSessionStatus(${s.id}, 'force_logout')">Force Logout</button>
              <button class="action-btn" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0; padding:4px 8px; font-size:11px;" onclick="updateSessionStatus(${s.id}, 'mark_safe')">Mark Safe</button>
            `;
          } else {
            actionBtn = `<span style="color:var(--text3); font-style:italic;">Read-Only</span>`;
          }
        } else {
          actionBtn = `<span style="color:var(--text3); font-style:italic;">No Actions Available</span>`;
        }
        
        return `
          <tr>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${escapeHTML(s.user_id)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); font-family:monospace;">${escapeHTML(s.ip_address)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${escapeHTML(s.browser)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${escapeHTML(s.device)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${escapeHTML(s.location)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${new Date(s.login_time).toLocaleString()}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); font-weight:700; color:${s.status==='Active'?'#16a34a':s.status==='Safe'?'#3b82f6':'#ef4444'}">${escapeHTML(s.status)}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${actionBtn}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error("Failed to load sessions:", err);
  }
}

async function updateSessionStatus(sessionId, action) {
  try {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('action', action);
    formData.append('admin_user', sessionStorage.getItem('adminEmail') || 'Admin');
    
    const res = await adminFetch(`${API_URL}/api/login_sessions.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Session status updated: ${action}`);
      openReviewSessionsModal(); // refresh list
    } else {
      showToast(`Failed: ${data.message}`);
    }
  } catch (err) {
    console.error("Failed to update session status:", err);
  }
}

// ── BLOCK IP MODAL LOGIC ──
function openBlockIpModal(ipAddress) {
  document.getElementById('block-ip-address').value = ipAddress || '';
  document.getElementById('block-ip-reason').value = '';
  document.getElementById('block-ip-modal-overlay').classList.add('open');
  
  const isSuper = sessionStorage.getItem('adminRole') === 'Super Admin';
  const submitBtn = document.querySelector('#block-ip-modal-overlay button[onclick*="submitBlockIp"]');
  const ipField = document.getElementById('block-ip-address');
  const reasonField = document.getElementById('block-ip-reason');
  const durField = document.getElementById('block-ip-duration');
  
  if (ipField) ipField.disabled = !isSuper;
  if (reasonField) reasonField.disabled = !isSuper;
  if (durField) durField.disabled = !isSuper;
  if (submitBtn) submitBtn.style.display = isSuper ? '' : 'none';
  
  fetchBlockedIps();
}

async function fetchBlockedIps() {
  const tbody = document.getElementById('blocked-ips-list-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Loading blocked list...</td></tr>';
  
  try {
    const res = await adminFetch(`${API_URL}/api/blocked_ips.php`);
    const data = await res.json();
    if (data.success) {
      const activeBlocks = data.blocked_ips.filter(b => b.status === 'Blocked');
      if (activeBlocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text3);">No active IP blocks.</td></tr>';
        return;
      }
      const isSuperAdmin = sessionStorage.getItem('adminRole') === 'Super Admin';
      tbody.innerHTML = activeBlocks.map(b => {
        const actionBtn = isSuperAdmin 
          ? `<button class="action-btn" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0; padding:2px 6px; font-size:11px;" onclick="unblockIp('${escapeHTML(b.ip_address)}')">Unblock</button>` 
          : `<span style="color:var(--text3); font-style:italic;">Banned</span>`;
        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px; font-family:monospace; font-weight:700;">${escapeHTML(b.ip_address)}</td>
            <td style="padding:8px; color:var(--text3);">${escapeHTML(b.reason)}</td>
            <td style="padding:8px; color:var(--text3);">${b.expires_at ? new Date(b.expires_at).toLocaleString() : 'Permanent'}</td>
            <td style="padding:8px; text-align:right;">${actionBtn}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error("Failed to fetch blocked IPs:", err);
  }
}

async function submitBlockIp() {
  const ip = document.getElementById('block-ip-address').value;
  const reason = document.getElementById('block-ip-reason').value;
  const duration = document.getElementById('block-ip-duration').value;
  
  if (!ip || !reason) {
    showToast("Please enter a reason for the block.");
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('action', 'block');
    formData.append('ip_address', ip);
    formData.append('reason', reason);
    formData.append('duration', duration);
    formData.append('blocked_by', sessionStorage.getItem('adminEmail') || 'Admin');
    
    const res = await adminFetch(`${API_URL}/api/blocked_ips.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`IP ${ip} blocked successfully.`);
      fetchBlockedIps(); // refresh list
      fetchAlerts(true);  // refresh alerts dashboard
    } else {
      showToast(`Failed: ${data.message}`);
    }
  } catch (err) {
    console.error("Failed to block IP:", err);
  }
}

async function unblockIp(ipAddress) {
  try {
    const formData = new FormData();
    formData.append('action', 'unblock');
    formData.append('ip_address', ipAddress);
    formData.append('blocked_by', sessionStorage.getItem('adminEmail') || 'Admin');
    
    const res = await adminFetch(`${API_URL}/api/blocked_ips.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`IP ${ipAddress} unblocked.`);
      fetchBlockedIps(); // refresh list
      fetchAlerts(true);  // refresh alerts dashboard
    } else {
      showToast(`Failed: ${data.message}`);
    }
  } catch (err) {
    console.error("Failed to unblock IP:", err);
  }
}

// ── RETRY SYNC ACTION LOGIC ──
async function triggerSyncRetry() {
  document.getElementById('sync-progress-bar').style.width = '0%';
  document.getElementById('sync-progress-text').textContent = '0% Completed';
  document.getElementById('sync-progress-counts').textContent = 'Initialising...';
  document.getElementById('sync-success-count').textContent = '0';
  document.getElementById('sync-failed-count').textContent = '0';
  document.getElementById('sync-remaining-count').textContent = 'Calculating...';
  
  document.getElementById('sync-progress-modal-overlay').classList.add('open');
  
  try {
    const formData = new FormData();
    formData.append('action', 'retry');
    formData.append('admin_user', sessionStorage.getItem('adminEmail') || 'Admin');
    
    const res = await adminFetch(`${API_URL}/api/sync_jobs.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.status === 202 || data.success) {
      showToast("Sync retry job scheduled in background.");
      // We keep the progress modal open to let the Pusher socket stream progress
      fetchAlerts(true); 
    } else {
      showToast(`Sync retry failed: ${data.message}`);
      document.getElementById('sync-progress-modal-overlay').classList.remove('open');
    }
  } catch (err) {
    console.error("Sync retry failed:", err);
    document.getElementById('sync-progress-modal-overlay').classList.remove('open');
  }
}

// ── SYSTEM LOG VIEWER MODAL LOGIC ──
function openLogViewerModal() {
  document.getElementById('log-search-input').value = '';
  document.getElementById('log-viewer-modal-overlay').classList.add('open');
  fetchSystemLogs();
}

async function fetchSystemLogs() {
  const tbody = document.getElementById('logs-modal-tbody');
  if (!tbody) return;
  
  const range = document.getElementById('log-filter-time').value;
  const search = document.getElementById('log-search-input').value;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">⏳ Querying system logs...</td></tr>';
  
  try {
    const res = await adminFetch(`${API_URL}/api/system_logs.php?time_range=${range}&search=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (data.success) {
      if (data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text3);">No matching logs found.</td></tr>';
        return;
      }
      tbody.innerHTML = data.logs.map(l => {
        const rowBg = l.log_level === 'ERROR' ? '#fef2f2' : l.log_level === 'WARNING' ? '#fffbeb' : '#fff';
        const levelCol = l.log_level === 'ERROR' ? '#dc2626' : l.log_level === 'WARNING' ? '#d97706' : '#16a34a';
        
        let traceHtml = '';
        if (l.stack_trace) {
          traceHtml = `
            <details style="cursor:pointer; color:var(--text3); font-family:monospace; font-size:10px;">
              <summary>View Stack Trace</summary>
              <pre style="margin-top:6px; background:#f1f5f9; padding:8px; border-radius:6px; overflow-x:auto; max-width:400px; text-align:left;">${escapeHTML(l.stack_trace)}</pre>
            </details>
          `;
        } else {
          traceHtml = '<span style="color:var(--text3); font-style:italic;">None</span>';
        }
        
        return `
          <tr style="background:${rowBg}; border-bottom:1px solid var(--border);">
            <td style="padding:10px; white-space:nowrap;">${new Date(l.timestamp).toLocaleString()}</td>
            <td style="padding:10px; font-weight:700;">${escapeHTML(l.service_name)}</td>
            <td style="padding:10px; font-weight:800; color:${levelCol}">${escapeHTML(l.log_level)}</td>
            <td style="padding:10px; max-width:250px; word-break:break-word;">${escapeHTML(l.message)}</td>
            <td style="padding:10px;">${traceHtml}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error("Failed to load logs:", err);
  }
}

function exportSystemLogsCSV() {
  const token = sessionStorage.getItem('adminToken') || '';
  const range = document.getElementById('log-filter-time').value;
  const search = document.getElementById('log-search-input').value;
  window.open(`${API_URL}/api/system_logs.php?export=true&token=${token}&time_range=${range}&search=${encodeURIComponent(search)}`);
  showToast("CSV Export Started!");
}

// ── UPDATE WIDGET STATS & DASHBOARD DATA ──
function updateDashboardAlertStats() {
  const activeSecurity = alertState.allAlerts.filter(a => a.alert_type === 'security' && (a.status === 'Active' || a.status === 'Investigating')).length;
  const activeSystem = alertState.allAlerts.filter(a => a.alert_type === 'system' && (a.status === 'Active' || a.status === 'Investigating')).length;
  
  const failedLoginsToday = alertState.allAlerts
    .filter(a => a.alert_type === 'security' && (a.title || '').toLowerCase().includes('failed login'))
    .reduce((sum, a) => {
      const match = a.title.match(/(\d+) failed/i);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
  
  const securityWidgetValue = document.getElementById('widget-active-security');
  if (securityWidgetValue) securityWidgetValue.textContent = activeSecurity;

  const systemWidgetValue = document.getElementById('widget-active-system');
  if (systemWidgetValue) systemWidgetValue.textContent = activeSystem;
  
  const failedLoginsWidget = document.getElementById('widget-failed-logins');
  if (failedLoginsWidget) failedLoginsWidget.textContent = failedLoginsToday;
}

async function renderAlertWidgets() {
  const container = document.getElementById('alert-dashboard-widgets');
  if (!container) return;

  let blockedIpCount = 0;
  try {
    const res = await adminFetch(`${API_URL}/api/blocked_ips.php`);
    const data = await res.json();
    if (data.success) {
      blockedIpCount = data.blocked_ips.filter(b => b.status === 'Blocked').length;
    }
  } catch (e) {}

  let queueBacklog = 0;
  try {
    const res = await adminFetch(`${API_URL}/api/sync_jobs.php`);
    const data = await res.json();
    if (data.success) {
      queueBacklog = data.total_queue;
    }
  } catch (e) {}

  const activeSecurity = alertState.allAlerts.filter(a => a.alert_type === 'security' && (a.status === 'Active' || a.status === 'Investigating')).length;
  const activeSystem = alertState.allAlerts.filter(a => a.alert_type === 'system' && (a.status === 'Active' || a.status === 'Investigating')).length;
  
  const failedLoginsToday = alertState.allAlerts
    .filter(a => a.alert_type === 'security' && (a.title || '').toLowerCase().includes('failed login'))
    .reduce((sum, a) => {
      const match = a.title.match(/(\d+) failed/i);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

  let healthScore = 100;
  alertState.allAlerts.forEach(a => {
    if (a.status === 'Active') {
      if (a.severity === 'Critical') healthScore -= 15;
      else healthScore -= 5;
    }
  });
  if (queueBacklog > 0) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  let healthColor = '#16a34a';
  if (healthScore < 50) healthColor = '#ef4444';
  else if (healthScore < 85) healthColor = '#f97316';

  container.innerHTML = `
    <div class="stat-card" onclick="switchAdminView('notification', document.querySelector('[onclick*=\\'notification\\']'))" style="cursor:pointer;">
      <div class="stat-card-val" style="color:#ef4444" id="widget-active-security">${activeSecurity}</div>
      <div class="stat-card-label">Active Security Alerts</div>
      <div class="stat-card-trend">Lockouts & abuse</div>
    </div>
    <div class="stat-card" onclick="switchAdminView('notification', document.querySelector('[onclick*=\\'notification\\']'))" style="cursor:pointer;">
      <div class="stat-card-val" style="color:#f97316" id="widget-active-system">${activeSystem}</div>
      <div class="stat-card-label">Active System Alerts</div>
      <div class="stat-card-trend">Service health issues</div>
    </div>
    <div class="stat-card" onclick="openBlockIpModal()" style="cursor:pointer;">
      <div class="stat-card-val" style="color:#64748b">${blockedIpCount}</div>
      <div class="stat-card-label">Blocked IP Count</div>
      <div class="stat-card-trend">Banned connections</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-val" style="color:#3b82f6" id="widget-failed-logins">${failedLoginsToday}</div>
      <div class="stat-card-label">Failed Logins Today</div>
      <div class="stat-card-trend">Brute force monitor</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-val" style="color:${healthColor}">${healthScore}%</div>
      <div class="stat-card-label">System Health Score</div>
      <div class="stat-card-trend">Real-time status</div>
    </div>
    <div class="stat-card" onclick="triggerSyncRetry()" style="cursor:pointer;">
      <div class="stat-card-val" style="color:#eab308">${queueBacklog}</div>
      <div class="stat-card-label">Queue Backlog Count</div>
      <div class="stat-card-trend">Pending sync jobs</div>
    </div>
  `;
}

// Initialise countdown loop
if (!alertState.intervalId) {
  alertState.intervalId = setInterval(updateAlertsCountdown, 1000);
}

// --- Admin Login Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const emailField = document.getElementById('admin-email');
  const passField = document.getElementById('admin-pass');
  const rememberCheckbox = document.getElementById('admin-remember');
  
  // Password must never be retained
  if (passField) passField.value = '';
  
  if (localStorage.getItem('adminRememberMe') === 'true') {
    if (emailField) emailField.value = localStorage.getItem('savedAdminEmail') || '';
    if (rememberCheckbox) rememberCheckbox.checked = true;
  } else {
    // Clear everything if remember me is not intentionally enabled
    if (emailField) emailField.value = '';
    if (rememberCheckbox) rememberCheckbox.checked = false;
  }
});
