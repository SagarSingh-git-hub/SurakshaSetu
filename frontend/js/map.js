// ── LEAFLET MAP OPERATIONS ──
let mainMap, allMarkers=[], miniMap, miniMarker;
let currentMapFilter = 'All';

async function initMap(){
  mainMap = L.map('main-map',{zoomControl:true}).setView([27.18,78.01],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap',maxZoom:19
  }).addTo(mainMap);
  
  await fetchReports();
  currentReports.forEach(r=>addMapMarker(r));
  setTimeout(() => { mainMap.invalidateSize(); }, 100);
}

function makeIcon(cat,status){
  const col = CAT_COLORS[cat]||CAT_COLORS.Other;
  const color = status==='Resolved'?'#16a34a':col.pin;
  return L.divIcon({
    className:'',
    html:`<div style="width:32px;height:40px;position:relative">
      <div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>
      <div style="position:absolute;top:4px;left:5px;font-size:14px">${(CAT_COLORS[cat]||CAT_COLORS.Other).emoji}</div>
    </div>`,
    iconSize:[32,40], iconAnchor:[16,40], popupAnchor:[0,-40]
  });
}

function addMapMarker(r){
  const m = L.marker([r.lat,r.lng],{icon:makeIcon(r.cat,r.status)})
    .addTo(mainMap)
    .bindPopup(`<div style="font-family:Outfit,sans-serif;min-width:180px">
      <div style="font-size:14px;font-weight:800;margin-bottom:4px">${(CAT_COLORS[r.cat]||CAT_COLORS.Other).emoji} ${r.id}</div>
      <div style="font-size:12px;font-weight:700;color:${(CAT_COLORS[r.cat]||CAT_COLORS.Other).color}">${r.cat}</div>
      <div style="font-size:12px;color:#6b7280;margin:4px 0">${r.loc}</div>
      <div style="font-size:11px;color:#374151">${(r.desc||'').substring(0,80)}...</div>
      <div style="margin-top:8px"><span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#dcfce7;color:#15803d">${r.status}</span></div>
    </div>`,{maxWidth:220});
  allMarkers.push({marker:m,report:r});
}

function filterMap(cat, btn){
  currentMapFilter = cat;
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  allMarkers.forEach(({marker,report})=>{
    if(cat==='All') marker.addTo(mainMap);
    else if(cat==='Resolved'){ if(report.status==='Resolved')marker.addTo(mainMap);else mainMap.removeLayer(marker); }
    else { if(report.cat===cat)marker.addTo(mainMap);else mainMap.removeLayer(marker); }
  });
}
