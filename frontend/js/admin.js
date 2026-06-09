// ── ADMIN PANEL AND DASHBOARD OPERATIONS ──
let adminFilter = { status: '', cat: '' };
// currentAdminPassword is declared in app.js and shared globally

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
    sessionStorage.setItem('adminLoggedIn', 'true');
    sessionStorage.setItem('adminPassword', p);
    document.getElementById('admin-login-wrap').style.display = 'none';
    document.getElementById('admin-dashboard').classList.add('active');
    
    const parts = window.location.hash.substring(1).split('/');
    const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
    renderAdminDashboard(sub);
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
      sessionStorage.removeItem('adminLoggedIn');
      sessionStorage.removeItem('adminPassword');
      const loginWrap = document.getElementById('admin-login-wrap');
      const dashboard = document.getElementById('admin-dashboard');
      if (loginWrap) loginWrap.style.display = '';
      if (dashboard) dashboard.classList.remove('active');
      showToast('Logged out successfully.');
      showPage('home');
    }
  );
}

async function renderAdminDashboard(initialView = 'overview') {
  // Only fetch if empty, otherwise use currentReports to prevent slow UI
  if (currentReports.length === 0) await fetchReports();
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
            if (selectedMapIssue === id) {
              selectedMapIssue = null;
              switchMapPanel('list', document.querySelectorAll('.m-ptab')[0]);
            }
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
      `<div style="width:100%;height:140px;border-radius:10px;overflow:hidden;margin-bottom:16px;box-shadow:var(--shadow2)"><img src="${issue.photo_urls[0]}" style="width:100%;height:100%;object-fit:cover;"></div>` : 
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
  const wrapper = document.getElementById('preview-wrapper');
  if (mode === 'mobile') {
    wrapper.classList.add('mobile-mode');
    document.getElementById('btn-preview-mobile').style.background = 'var(--bg3)';
    document.getElementById('btn-preview-mobile').style.color = 'var(--text)';
    document.getElementById('btn-preview-desktop').style.background = 'transparent';
    document.getElementById('btn-preview-desktop').style.color = 'var(--text3)';
  } else {
    wrapper.classList.remove('mobile-mode');
    document.getElementById('btn-preview-desktop').style.background = 'var(--bg3)';
    document.getElementById('btn-preview-desktop').style.color = 'var(--text)';
    document.getElementById('btn-preview-mobile').style.background = 'transparent';
    document.getElementById('btn-preview-mobile').style.color = 'var(--text3)';
  }
  updatePreviewScale();
}

function updatePreviewScale() {
  const wrapper = document.getElementById('preview-wrapper');
  const scaleContainer = document.getElementById('preview-scale-container');
  if (!wrapper || !scaleContainer) return;
  const container = scaleContainer.parentElement;
  if (!wrapper.classList.contains('mobile-mode')) {
    // Desktop scale
    const availableWidth = container.clientWidth - 48;
    const availableHeight = container.clientHeight - 100;
    const scaleX = availableWidth / 794;
    const scaleY = availableHeight / 1123;
    const scale = Math.max(0.3, Math.min(scaleX, scaleY, 1));
    wrapper.style.transform = `scale(${scale})`;
    scaleContainer.style.width = `${794 * scale}px`;
    scaleContainer.style.height = `${1123 * scale}px`;
  } else {
    wrapper.style.transform = 'scale(1)';
    scaleContainer.style.width = `375px`;
    scaleContainer.style.height = `667px`;
  }
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
      if (typeof fetchTemplates === 'function') {
        fetchTemplates();
      }
    } else {
      showToast('❌ Failed: ' + data.message);
    }
  } catch (e) {
    console.error(e);
    showToast('❌ Error saving template');
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

  let content = template.html_content || '';
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
  doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#e2e8f0;font-family:sans-serif;} .cert-container{box-shadow:0 10px 40px rgba(0,0,0,0.1);background:#fff;max-width:95%;max-height:95%;overflow:hidden;transform-origin:center center;} *{box-sizing:inherit;}</style></head><body><div class="cert-container">' + content + '</div></body></html>');
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
  showCustomConfirm("Set Default?", "Are you sure you want to set this template as the default template?", async () => {
    const formData = new FormData();
    formData.append('admin_password', currentAdminPassword);
    formData.append('id', id);

    try {
      const res = await fetch(`${API_URL}/api/certificates/set_default_template.php`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Default template set successfully!');
        
        // Refresh local templates array & UI
        if (typeof fetchTemplates === 'function') {
          await fetchTemplates();
        }
        
        // Refresh the preview to update button state
        openTemplatePreview(id);
      } else {
        showToast('❌ Failed: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Error setting default template');
    }
  });
}

function showCustomConfirm(title, message, onAccept) {
  const overlay = document.getElementById('custom-confirm-overlay');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const acceptBtn = document.getElementById('btn-confirm-accept');
  
  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;
  
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      if (overlay) overlay.classList.remove('open');
      if (typeof onAccept === 'function') onAccept();
    };
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

async function fetchTemplates() {
  const container = document.getElementById('cert-templates-container');
  if (!container) return;
  try {
    const res = await fetch(`${API_URL}/api/certificates/get_templates.php`);
    const data = await res.json();
    if (data.success && data.templates.length > 0) {
      allTemplates = data.templates;
      container.innerHTML = data.templates.map(t => {
        if (t.is_custom_html == 1) {
          // Render custom HTML template card
          return `
            <div class="admin-widget" onclick="openTemplatePreview(${t.id})" style="overflow:hidden;border:1px solid #bfdbfe;cursor:pointer;">
              <div style="height:130px;display:flex;align-items:center;justify-content:center;background:#f8fafc;position:relative;">
                <div style="font-family:monospace;font-size:12px;color:var(--text3);"><i class="ph-duotone ph-code" style="font-size:24px;"></i><br>Custom HTML Template</div>
              </div>
              <div style="padding:16px;border-top:1px solid var(--border);background:#fff;">
                <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${t.name}</div>
                <div style="font-size:12px;color:var(--text3);">${t.award_type}</div>
              </div>
            </div>`;
        } else {
          // Render visual builder template card
          return `
            <div class="admin-widget" onclick="openTemplatePreview(${t.id})" style="overflow:hidden;border:1px solid var(--border);cursor:pointer;">
              <div style="height:130px;display:flex;align-items:center;justify-content:center;position:relative;background:${t.bg_gradient};">
                <div style="text-align:center;">
                  <div style="font-family:'Georgia',serif;font-size:16px;color:${t.primary_color};margin-bottom:4px;font-weight:700;">${t.name}</div>
                  <div style="width:60px;height:1px;background:${t.primary_color};margin:0 auto 6px;"></div>
                  <div style="font-size:11px;color:var(--text2);text-transform:uppercase;">${t.award_type}</div>
                  <div style="margin-top:10px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.5);border:1px solid ${t.primary_color};display:flex;align-items:center;justify-content:center;margin-left:auto;margin-right:auto;">
                    <i class="${t.icon_class}" style="font-size:18px;color:${t.primary_color};"></i>
                  </div>
                </div>
                ${t.is_default == 1 ? `<div style="position:absolute;top:10px;right:10px;"><span style="font-size:10px;padding:3px 8px;border-radius:12px;font-weight:700;background:#fef3c7;color:#d97706;">Default</span></div>` : ''}
              </div>
              <div style="padding:16px;border-top:1px solid var(--border);background:#fff;">
                <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${t.name}</div>
                <div style="font-size:12px;color:var(--text3);">${t.usage_count} Uses</div>
              </div>
            </div>`;
        }
      }).join('');
    } else {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);">No templates found. Create one to get started!</div>';
    }
  } catch (e) {
    console.error("Error fetching templates", e);
  }
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
