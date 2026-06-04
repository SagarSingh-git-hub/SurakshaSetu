// ── REPORT WIZARD FORM LOGIC ──
let formStep = 1, formData = {};

function initReportForm() {
  formStep = 1; formData = { photos: [], category: '', desc: '', lat: null, lng: null, locStr: 'Detecting...', aiAnalysis: null, isAnalyzing: false };
  renderStep(1);
}

function renderStep(step) {
  const body = document.getElementById('report-body');
  if (!body) return;
  // Update indicators
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('sd-' + i);
    const item = document.getElementById('si-' + i);
    if (dot && item) {
      dot.classList.remove('done', 'active');
      item.classList.remove('done', 'active');
      if (i < step) { dot.classList.add('done'); item.classList.add('done'); }
      else if (i === step) { dot.classList.add('active'); item.classList.add('active'); }
    }
  }
  if (step === 1) body.innerHTML = renderStep1();
  else if (step === 2) body.innerHTML = renderStep2();
  else if (step === 3) body.innerHTML = renderStep3();
  else if (step === 4) body.innerHTML = renderStep4();
  if (step === 1) initMiniMap();
}

function renderStep1() {
  return `<div class="form-group">
    <label class="form-label">📍 Your Location</label>
    <div class="location-box">
      <div class="location-icon">📍</div>
      <div>
        <div class="location-text" id="loc-display">${formData.locStr}</div>
        <div class="location-sub">Tap detect to use GPS, or pin on map below</div>
      </div>
      <button class="btn-detect" onclick="detectGPS()">Detect GPS</button>
    </div>
    <div id="mini-map"></div>
  </div>
  <div class="form-nav">
    <button class="btn-back" onclick="showPage('home')">← Back</button>
    <button class="btn-next" onclick="nextStep(1)" ${formData.lat ? '' : 'disabled'} id="step1-next">Next: Photos →</button>
  </div>`;
}

function renderStep2() {
  const previews = formData.photos.map((p, i) => `
    <div class="photo-preview-wrap">
      <img class="photo-preview" src="${p}">
      <button class="photo-remove" onclick="removePhoto(${i})">✕</button>
    </div>`).join('');
  return `<div class="form-group">
    <label class="form-label">📸 Upload Photos (up to 6)</label>
    <label class="photo-upload-area" for="photo-input">
      <div class="photo-upload-icon">📷</div>
      <div class="photo-upload-text">Tap to add photos</div>
      <div class="photo-upload-sub">JPG, PNG, WEBP • Max 10MB each</div>
      <input type="file" id="photo-input" accept="image/*" multiple onchange="handlePhotos(this)">
    </label>
    <div class="photo-previews" id="photo-previews">${previews}</div>
  </div>
  ${formData.photos.length > 0 ? `<div class="ai-analysis-box">
    <div style="font-size:12px;font-weight:800;color:#1d4ed8;margin-bottom:6px;font-family:Outfit,sans-serif;display:flex;justify-content:space-between;align-items:center;">
      <span>🤖 AI Analysis</span>
      ${formData.isAnalyzing ? '<span style="font-size:10px;color:#64748b;font-weight:500">Analyzing image...</span>' : ''}
    </div>
    ${formData.isAnalyzing ? `
      <div style="display:flex;justify-content:center;padding:20px 0;">
        <div class="loading-spinner" style="width:24px;height:24px;border:3px solid var(--g200);border-top:3px solid #1d4ed8;border-radius:50%;animation:spin 1s linear infinite;"></div>
      </div>
    ` : formData.aiAnalysis ? `
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:${formData.aiAnalysis.is_valid_issue ? 'var(--text1)' : '#ef4444'}">
        ${formData.aiAnalysis.issue_detected}
        ${!formData.aiAnalysis.is_valid_issue ? '<span style="font-size:10px;font-weight:600;margin-left:6px;color:#ef4444;background:#fee2e2;padding:2px 6px;border-radius:4px;">Action Required</span>' : ''}
      </div>
      <div id="ai-tags">
        ${formData.aiAnalysis.tags.map(tag => `<span class="ai-tag">${tag}</span>`).join('')}
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:12px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:#475569;font-family:Outfit,sans-serif;font-weight:700">Priority:</span>
          <span class="priority-badge ${formData.aiAnalysis.priority.toLowerCase()}">● ${formData.aiAnalysis.priority}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:#475569;font-family:Outfit,sans-serif;font-weight:700">Confidence:</span>
          <span style="font-size:12px;font-weight:600;color:var(--text2)">${formData.aiAnalysis.confidence}%</span>
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text2);line-height:1.4;background:var(--g50);padding:8px;border-radius:6px;border:1px solid var(--g100)">
        ${formData.aiAnalysis.summary}
        ${!formData.aiAnalysis.is_valid_issue ? '<div style="margin-top:6px;font-weight:700;color:#ef4444;">Please upload a clear image of an environmental issue to proceed.</div>' : ''}
      </div>
    ` : `
      <div style="font-size:12px;color:var(--text3);text-align:center;padding:10px 0;">
        Upload a photo to detect issues automatically.
      </div>
    `}
  </div>`: ''}
  <div class="form-nav">
    <button class="btn-back" onclick="prevStep(2)">← Back</button>
    <button class="btn-next" onclick="nextStep(2)" ${formData.photos.length > 0 && !formData.isAnalyzing && (formData.aiAnalysis ? formData.aiAnalysis.is_valid_issue : true) ? '' : 'disabled'} id="step2-next">Next: Category →</button>
  </div>`;
}

function renderStep3() {
  const cats = [
    { id: 'Garbage', icon: '🗑', desc: 'Waste dumps, overflowing bins' },
    { id: 'Plastic Waste', icon: '🧴', desc: 'Single-use plastics, packaging' },
    { id: 'Dirty Area', icon: '🪣', desc: 'Unhygienic public spaces' },
    { id: 'Junkyard', icon: '🔧', desc: 'Scrap, illegal disposal sites' },
    { id: 'Water Pollution', icon: '💧', desc: 'Contaminated water bodies' },
    { id: 'Plantation Opportunity', icon: '🌱', desc: 'Land suitable for planting' },
    { id: 'Other', icon: '✦', desc: 'Other environmental issues' },
  ];
  return `<div class="form-group">
    <label class="form-label">🏷 Issue Category</label>
    <div class="categories-grid">
      ${cats.map(c => `<div class="cat-option ${formData.category === c.id ? 'selected' : ''}" onclick="selectCat('${c.id}',this)">
        <div class="cat-option-icon">${c.icon}</div>
        <div><div class="cat-option-name">${c.id}</div><div class="cat-option-desc">${c.desc}</div></div>
      </div>`).join('')}
    </div>
  </div>
  <div class="form-nav">
    <button class="btn-back" onclick="prevStep(3)">← Back</button>
    <button class="btn-next" onclick="nextStep(3)" ${formData.category ? '' : 'disabled'} id="step3-next">Next: Details →</button>
  </div>`;
}

function renderStep4() {
  return `<div class="form-group">
    <label class="form-label">📝 Description (optional)</label>
    <textarea class="form-input" placeholder="Describe the issue — size, smell, nearby landmarks, how long it has been here..." maxlength="500" oninput="formData.desc=this.value">${formData.desc}</textarea>
    <div style="font-size:11px;color:var(--text3);text-align:right;margin-top:4px"><span id="char-count">${formData.desc.length}</span>/500</div>
  </div>
  <div style="background:var(--g50);border:1px solid var(--g100);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:800;color:var(--g700);margin-bottom:10px;font-family:Outfit,sans-serif">📋 Report Summary</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px">
      <span style="color:var(--text3);font-weight:700">Category:</span><span>${formData.category}</span>
      <span style="color:var(--text3);font-weight:700">Location:</span><span>${formData.locStr}</span>
      <span style="color:var(--text3);font-weight:700">Photos:</span><span>${formData.photos.length} uploaded</span>
    </div>
  </div>
  <div class="form-nav">
    <button class="btn-back" onclick="prevStep(4)">← Back</button>
    <button class="btn-next" onclick="submitReport()" style="background:linear-gradient(135deg,#16a34a,#14532d)">🌿 Submit Report</button>
  </div>`;
}

function initMiniMap() {
  setTimeout(() => {
    const el = document.getElementById('mini-map');
    if (!el) return;
    if (miniMap) {
      miniMap.remove();
      miniMap = null;
    }
    miniMap = L.map('mini-map').setView([29.2183, 79.5130], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(miniMap);
    if (formData.lat) {
      miniMarker = L.marker([formData.lat, formData.lng]).addTo(miniMap);
      miniMap.setView([formData.lat, formData.lng], 15);
    }
    miniMap.on('click', async e => {
      formData.lat = e.latlng.lat; formData.lng = e.latlng.lng;
      const locDisplay = document.getElementById('loc-display');
      if (locDisplay) locDisplay.textContent = 'Detecting address...';

      // Reverse Geocoding with OpenStreetMap Nominatim for manual pin
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${formData.lat}&lon=${formData.lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const place = addr.suburb || addr.neighbourhood || addr.city_district || addr.road || '';
          const city = addr.city || addr.town || addr.county || '';

          if (place && city) {
            formData.locStr = `${place}, ${city}`;
          } else if (place || city) {
            formData.locStr = place || city;
          } else {
            formData.locStr = data.display_name.split(',').slice(0, 2).join(',');
          }
        } else {
          formData.locStr = `${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)}`;
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
        formData.locStr = `${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)}`;
      }

      if (miniMarker) miniMap.removeLayer(miniMarker);
      miniMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(miniMap);
      if (locDisplay) locDisplay.textContent = formData.locStr;
      const step1Next = document.getElementById('step1-next');
      if (step1Next) step1Next.removeAttribute('disabled');
    });
  }, 100);
}

function detectGPS() {
  const d = document.getElementById('loc-display');
  if (d) d.textContent = 'Detecting precise location...';

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        formData.lat = pos.coords.latitude;
        formData.lng = pos.coords.longitude;

        // Reverse Geocoding with OpenStreetMap Nominatim
        try {
          // Increase zoom to 18 for more detailed street-level address
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${formData.lat}&lon=${formData.lng}&zoom=18&addressdetails=1`);
          const data = await res.json();
          if (data && data.address) {
            // Build a highly accurate human-readable address
            const addr = data.address;
            const road = addr.road || addr.pedestrian || addr.footway || '';
            const neighbourhood = addr.neighbourhood || addr.suburb || addr.village || addr.city_district || '';
            const city = addr.city || addr.town || addr.county || addr.state || '';
            const postcode = addr.postcode || '';

            let parts = [];
            if (road) parts.push(road);
            if (neighbourhood) parts.push(neighbourhood);
            if (city) parts.push(city);
            if (postcode) parts.push(postcode);

            if (parts.length > 0) {
              formData.locStr = parts.join(', ');
            } else if (data.display_name) {
              formData.locStr = data.display_name.split(',').slice(0, 3).join(', ');
            } else {
              formData.locStr = `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
            }
          } else {
            formData.locStr = `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
          }
        } catch (e) {
          console.error("Reverse geocoding failed", e);
          formData.locStr = `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`;
        }

        if (d) d.textContent = formData.locStr;
        const step1Next = document.getElementById('step1-next');
        if (step1Next) step1Next.removeAttribute('disabled');

        if (miniMap) {
          if (miniMarker) miniMap.removeLayer(miniMarker);
          miniMarker = L.marker([formData.lat, formData.lng]).addTo(miniMap);
          miniMap.setView([formData.lat, formData.lng], 16); // High zoom for exact location
        }
      },
      (error) => {
        let errMsg = 'Failed to detect location.';
        if (error.code === error.PERMISSION_DENIED) {
          errMsg = 'Location permission denied.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errMsg = 'Location signal unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errMsg = 'GPS request timed out.';
        }

        // Preserve previous valid location if any, else show failure
        if (formData.lat && formData.lng) {
          if (d) d.textContent = formData.locStr || 'Location saved';
        } else {
          if (d) d.textContent = 'Detection failed';
          formData.locStr = 'Detection failed';
        }
        showToast('❌ ' + errMsg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } else {
    if (d) d.textContent = 'GPS not supported by browser';
    formData.locStr = 'GPS not supported by browser';
    showToast('❌ Geolocation is not supported by your browser.');
  }
}

function handlePhotos(input) {
  const files = Array.from(input.files).slice(0, 6 - formData.photos.length);
  let loaded = 0;
  if (files.length === 0) return;
  
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => { 
      formData.photos.push(e.target.result); 
      loaded++;
      if (loaded === files.length) {
        analyzeImage(formData.photos[formData.photos.length - 1]);
      }
    };
    r.readAsDataURL(f);
  });
}

function removePhoto(i) { 
  formData.photos.splice(i, 1); 
  if (formData.photos.length > 0) {
    analyzeImage(formData.photos[formData.photos.length - 1]);
  } else {
    formData.aiAnalysis = null;
    formData.isAnalyzing = false;
    renderStep(formStep);
  }
}

let currentAnalysisAborter = null;

async function analyzeImage(base64Image) {
  if (currentAnalysisAborter) {
    currentAnalysisAborter.abort();
  }
  currentAnalysisAborter = new AbortController();
  const signal = currentAnalysisAborter.signal;

  formData.isAnalyzing = true;
  formData.aiAnalysis = null;
  renderStep(formStep);
  
  try {
    const res = await fetch(`${API_URL}/api/analyze_image.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
      signal
    });
    const data = await res.json();
    if (signal.aborted) return;

    if (data.success && data.analysis) {
      formData.aiAnalysis = data.analysis;
      // Auto-select category if valid
      if (data.analysis.is_valid_issue && data.analysis.suggested_category) {
        formData.category = data.analysis.suggested_category;
      } else {
        formData.category = '';
      }
    } else {
      console.error('Analysis failed:', data.error);
      formData.aiAnalysis = {
        issue_detected: 'Analysis Failed',
        tags: ['Error'],
        priority: 'Low',
        confidence: 0,
        summary: 'Failed to analyze the image. You can still proceed manually.',
        is_valid_issue: true // Allow proceeding on error
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Error analyzing image:', err);
    formData.aiAnalysis = {
      issue_detected: 'Analysis Error',
      tags: ['Error'],
      priority: 'Low',
      confidence: 0,
      summary: 'Network error occurred during analysis. You can still proceed manually.',
      is_valid_issue: true // Allow proceeding on error
    };
  }
  formData.isAnalyzing = false;
  renderStep(formStep);
}

function selectCat(id, el) {
  formData.category = id;
  document.querySelectorAll('.cat-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const step3Next = document.getElementById('step3-next');
  if (step3Next) step3Next.removeAttribute('disabled');
}

function nextStep(s) { formStep = s + 1; renderStep(formStep); }
function prevStep(s) { formStep = s - 1; renderStep(formStep); }

async function submitReport() {
  const btn = document.querySelector('.btn-next');
  if (btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }

  const fd = new FormData();
  fd.append('category', formData.category);
  fd.append('desc', formData.desc);
  fd.append('lat', formData.lat);
  fd.append('lng', formData.lng);
  fd.append('locStr', formData.locStr);

  formData.photos.forEach(p => fd.append('photos[]', p));

  try {
    const response = await fetch(`${API_URL}/api/submit_report.php`, {
      method: 'POST',
      body: fd
    });
    const data = await response.json();

    if (data.success) {
      const id = data.report_id;
      const reportBody = document.getElementById('report-body');
      if (reportBody) {
        reportBody.innerHTML = `
              <div class="success-box">
                <div class="success-icon">🎉</div>
                <div class="success-title">Report Submitted!</div>
                <p style="color:var(--text3);font-size:14px;margin-top:8px">Your report is now live on the community map. Thank you for making a difference!</p>
                <div class="success-id">${id}</div>
                <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap">
                  <button class="btn-primary" onclick="showPage('map')">🗺 View on Map</button>
                  <button class="btn-secondary" onclick="initReportForm();formStep=1;renderStep(1)">+ Report Another</button>
                </div>
                <p style="font-size:11px;color:var(--text3);margin-top:20px">NGOs in your area have been notified and will review your report within 24 hours.</p>
              </div>`;
      }

      const sd1 = document.getElementById('sd-1');
      const sd2 = document.getElementById('sd-2');
      const sd3 = document.getElementById('sd-3');
      const sd4 = document.getElementById('sd-4');
      if (sd1) sd1.classList.add('done');
      if (sd2) sd2.classList.add('done');
      if (sd3) sd3.classList.add('done');
      if (sd4) sd4.classList.add('done', 'active');
      showToast('🌿 Report submitted successfully!');

      // Re-fetch reports so map is updated
      await fetchReports();
    } else {
      showToast('Error: ' + data.error);
      if (btn) { btn.textContent = '🌿 Submit Report'; btn.disabled = false; }
    }
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error(err);
    if (btn) { btn.textContent = '🌿 Submit Report'; btn.disabled = false; }
  }
}
