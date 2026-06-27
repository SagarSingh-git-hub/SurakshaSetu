// ── FEED AND DETAIL MODAL OPERATIONS ──
function timeAgo(dateStr){
  const d=new Date(dateStr), now=new Date();
  const diff=Math.floor((now-d)/86400000);
  if(diff===0)return'Today';
  if(diff===1)return'1 day ago';
  return diff+' days ago';
}

function renderFeed(reports){
  const grid=document.getElementById('feed-grid');
  if(!grid)return;
  if(reports.length === 0) {
    grid.innerHTML = `<div class="feed-empty-state">
      <div style="font-size: 48px; margin-bottom: 16px;">🌿</div>
      <div style="font-size: 18px; font-weight: 700; font-family: 'Outfit', sans-serif; color: var(--text2);">No reports found</div>
      <p style="margin-top: 8px;">Try adjusting your search or filter criteria.</p>
    </div>`;
    grid.style.display = 'flex';
    grid.style.alignItems = 'center';
    grid.style.justifyContent = 'center';
    return;
  }
  grid.style.display = 'grid';
  grid.style.alignItems = '';
  grid.style.justifyContent = '';
  grid.innerHTML=reports.map(r=>{
    const col=CAT_COLORS[r.cat]||CAT_COLORS.Other;
    let img;
    if (r.photo_urls && r.photo_urls.length > 0) {
        img = `<img class="feed-card-img" src="${r.photo_urls[0]}" alt="${r.cat}" loading="lazy">`;
    } else {
        img = `<div class="feed-card-img placeholder" style="background:linear-gradient(135deg,${col.bg},#f0fdf4)">${col.emoji}</div>`;
    }
    return `<div class="feed-card" onclick="openModal('${r.id}')">
      ${img}
      <div class="feed-card-body">
        <div class="feed-card-cat" style="background:${col.bg};color:${col.color}">${col.emoji} ${r.cat}</div>
        <div class="feed-card-title">${r.desc.substring(0,55)}...</div>
        <div class="feed-card-loc">📍 ${r.loc}</div>
        <div class="feed-card-meta">
          <span class="status-chip ${STATUS_CLASS[r.status]||'status-reported'}">${r.status}</span>
          <span class="time-ago">${timeAgo(r.date)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterFeed(q){
  const filtered=currentReports.filter(r=>r.loc.toLowerCase().includes(q.toLowerCase())||r.cat.toLowerCase().includes(q.toLowerCase())||r.desc.toLowerCase().includes(q.toLowerCase()));
  renderFeed(filtered);
}

function openModal(id){
  const r=currentReports.find(x=>x.id===id);
  if(!r)return;
  const col=CAT_COLORS[r.cat]||CAT_COLORS.Other;
  const modalTitle = document.getElementById('modal-title');
  const modalSub = document.getElementById('modal-sub');
  const modalBody = document.getElementById('modal-body');
  
  if(modalTitle) modalTitle.textContent=`${col.emoji} ${r.id} — ${r.cat}`;
  if(modalSub) modalSub.textContent=`${r.loc} • ${timeAgo(r.date)}`;
  if(modalBody) {
    modalBody.innerHTML=`
      <div style="background:${col.bg};border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;color:${col.color};line-height:1.5">${r.desc}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${r.tags.map(t=>`<span class="ai-tag">${t}</span>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;font-size:13px">
        <div style="background:var(--bg);border-radius:var(--radius-xs);padding:10px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);font-weight:800;text-transform:uppercase;letter-spacing:.4px;font-family:Outfit,sans-serif">Status</div>
          <div style="margin-top:4px"><span class="status-chip ${STATUS_CLASS[r.status]}">${r.status}</span></div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-xs);padding:10px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);font-weight:800;text-transform:uppercase;letter-spacing:.4px;font-family:Outfit,sans-serif">Priority</div>
          <div style="margin-top:4px"><span class="priority-badge ${r.priority.toLowerCase()}">${r.priority}</span></div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text3);display:flex;gap:16px;flex-wrap:wrap">
        <span>📸 ${r.photo_urls && r.photo_urls.length ? r.photo_urls.length : 0} photo${(r.photo_urls && r.photo_urls.length) === 1 ? '' : 's'}</span>
        <span>📅 ${r.date}</span>
        <span>📍 ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</span>
      </div>
      ${r.photo_urls && r.photo_urls.length > 0 ? `<div style="margin-top:16px;display:flex;gap:8px;overflow-x:auto;padding-bottom:8px">
        ${r.photo_urls.map(url => `<img src="${url}" onclick="openLightbox('${url}')" style="height:100px;border-radius:8px;object-fit:cover;flex-shrink:0;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" alt="Report photo">`).join('')}
      </div>` : ''}`;
  }
  
  const modalOverlay = document.getElementById('modal-overlay');
  if(modalOverlay) modalOverlay.classList.add('open');
}

function closeModal(e){
  const modalOverlay = document.getElementById('modal-overlay');
  if(modalOverlay && e.target===modalOverlay) modalOverlay.classList.remove('open');
}

// ── LIGHTBOX LOGIC ──
function openLightbox(url) {
  let lb = document.getElementById('image-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'image-lightbox';
    lb.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;';
    lb.innerHTML = `
      <span style="position:absolute;top:20px;right:30px;color:white;font-size:40px;cursor:pointer;font-family:Nunito,sans-serif;" onclick="closeLightbox()">&times;</span>
      <img id="lightbox-img" src="" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);transform:scale(0.9);transition:transform 0.3s;" alt="Full screen preview">
    `;
    lb.onclick = function(e) {
      if (e.target === lb) closeLightbox();
    };
    document.body.appendChild(lb);
  }
  
  const img = document.getElementById('lightbox-img');
  img.src = url;
  lb.style.display = 'flex';
  
  // Trigger animation
  requestAnimationFrame(() => {
    lb.style.opacity = '1';
    img.style.transform = 'scale(1)';
  });
}

function closeLightbox() {
  const lb = document.getElementById('image-lightbox');
  if (lb) {
    lb.style.opacity = '0';
    const img = document.getElementById('lightbox-img');
    if (img) img.style.transform = 'scale(0.9)';
    setTimeout(() => {
      lb.style.display = 'none';
    }, 300);
  }
}
