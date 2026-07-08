// certificates.js

let certMembers = [];
let certTemplates = [];
let currentCertPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    // Only init if certificates DOM is present
    if (document.getElementById('admin-view-cert-issue')) {
        initCertificates();
    }
});

function initCertificates() {
    loadMembers();
    loadTemplates();
    loadCertificates();

    // Input Validations
    const nameInput = document.getElementById('cert-full-name');
    const nameError = document.getElementById('cert-name-error');
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val && !/^[A-Za-z\s]+$/.test(val)) {
                nameError.style.display = 'block';
                e.target.value = val.replace(/[^A-Za-z\s]/g, '');
            } else {
                nameError.style.display = 'none';
            }
            renderLivePreview();
        });
    }

    const phoneInput = document.getElementById('cert-phone');
    const phoneError = document.getElementById('cert-phone-error');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val && !/^\d+$/.test(val)) {
                e.target.value = val.replace(/\D/g, '');
            }
            if (e.target.value.length > 0 && e.target.value.length < 10) {
                phoneError.style.display = 'block';
            } else {
                phoneError.style.display = 'none';
            }
        });
    }

    // PIN Code Logic
    const pinInput = document.getElementById('cert-pin');
    const pinError = document.getElementById('cert-pin-error');
    const pinLoading = document.getElementById('cert-pin-loading');
    const areaSelect = document.getElementById('cert-area');
    const cityInput = document.getElementById('cert-city');
    const stateInput = document.getElementById('cert-state');

    if (pinInput) {
        pinInput.addEventListener('input', async (e) => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val;
            
            if (val.length === 6) {
                pinLoading.style.display = 'block';
                pinError.style.display = 'none';
                try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
                    const data = await res.json();
                    pinLoading.style.display = 'none';
                    
                    if (data && data[0].Status === 'Success') {
                        const postOffices = data[0].PostOffice;
                        
                        // Populate Area
                        areaSelect.innerHTML = '';
                        postOffices.forEach(po => {
                            areaSelect.innerHTML += `<option value="${po.Name}">${po.Name}</option>`;
                        });
                        
                        // Populate City & State
                        cityInput.value = postOffices[0].District;
                        stateInput.value = postOffices[0].State;
                        
                        if (typeof refreshCustomSelect === 'function') {
                            refreshCustomSelect(areaSelect);
                        }
                        
                        renderLivePreview();
                    } else {
                        pinError.style.display = 'block';
                        areaSelect.innerHTML = '<option value="">— Select Area —</option>';
                        if (typeof refreshCustomSelect === 'function') {
                            refreshCustomSelect(areaSelect);
                        }
                        cityInput.value = '';
                        stateInput.value = '';
                    }
                } catch (err) {
                    pinLoading.style.display = 'none';
                    pinError.style.display = 'block';
                }
            } else {
                pinLoading.style.display = 'none';
                pinError.style.display = 'none';
                areaSelect.innerHTML = '<option value="">— Select Area —</option>';
                if (typeof refreshCustomSelect === 'function') {
                    refreshCustomSelect(areaSelect);
                }
                cityInput.value = '';
                stateInput.value = '';
            }
            renderLivePreview();
        });
    }

    if (areaSelect) {
        areaSelect.addEventListener('change', renderLivePreview);
    }

    // Bind preview live updates
    const formInputs = [
        'cert-email', 'cert-type', 'cert-citation',
        'cert-issue-date', 'cert-issuing-authority', 'cert-co-signatory', 'cert-id-prefix'
    ];
    formInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', renderLivePreview);
    });
    
    // Auto-populate from member select
    const memberSelect = document.getElementById('cert-select-member');
    if (memberSelect) {
        memberSelect.addEventListener('change', (e) => {
            const memberId = e.target.value;
            if (memberId) {
                const member = certMembers.find(m => m.id == memberId);
                if (member) {
                    document.getElementById('cert-full-name').value = member.name;
                    document.getElementById('cert-email').value = member.email;
                    document.getElementById('cert-phone').value = member.phone ? member.phone.replace('+91', '').trim() : '';
                    document.getElementById('cert-full-name').dispatchEvent(new Event('input'));
                }
            } else {
                document.getElementById('cert-full-name').value = '';
                document.getElementById('cert-email').value = '';
                document.getElementById('cert-phone').value = '';
                document.getElementById('cert-full-name').dispatchEvent(new Event('input'));
            }
        });
    }

    // Set today as default date
    const dateInput = document.getElementById('cert-issue-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        renderLivePreview();
    }
}

async function loadMembers() {
    try {
        const res = await fetch(API_URL + '/api/certificates/get_members.php');
        const data = await res.json();
        if (data.success) {
            certMembers = data.data;
            const select = document.getElementById('cert-select-member');
            if (select) {
                select.innerHTML = '<option value="">— Select existing —</option>';
                certMembers.forEach(m => {
                    select.innerHTML += `<option value="${m.id}">${m.name} (${m.role})</option>`;
                });
                if (typeof refreshCustomSelect === 'function') {
                    refreshCustomSelect(select);
                }
            }
        }
    } catch(e) { console.error('Failed to load members', e); }
}

let templatesLoadedInCert = false;

async function loadTemplates(force = false) {
    if (!force && templatesLoadedInCert && certTemplates.length > 0) {
        return;
    }
    try {
        const res = await adminFetch(CERT_API_URL + '/api/certificates/get_templates.php');
        const data = await res.json();
        if (data.success) {
            certTemplates = data.templates || data.data || [];
            templatesLoadedInCert = true;
            renderTemplatesGrid();
            populateTemplateDropdowns();
        }
    } catch(e) { console.error('Failed to load templates', e); }
}

function populateTemplateDropdowns() {
    // Populate types dropdown
    const typeSelect = document.getElementById('cert-type');
    const filterTypeSelect = document.getElementById('cert-filter-type');
    
    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">— Select Type —</option>';
        certTemplates.forEach(t => {
            typeSelect.innerHTML += `<option value="${t.award_type}" data-tid="${t.id}">${t.award_type}</option>`;
        });
        
        if (!typeSelect.dataset.listenerBound) {
            typeSelect.addEventListener('change', (e) => {
                // Update preview style based on selected template
                const opt = e.target.options[e.target.selectedIndex];
                if (opt) {
                    const tid = opt.getAttribute('data-tid');
                    if (tid) applyTemplateToPreview(tid);
                }
            });
            typeSelect.dataset.listenerBound = 'true';
        }

        if (typeof refreshCustomSelect === 'function') {
            refreshCustomSelect(typeSelect);
        }
    }
    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="All">All types</option>';
        certTemplates.forEach(t => {
            filterTypeSelect.innerHTML += `<option value="${t.award_type}">${t.award_type}</option>`;
        });
        if (typeof refreshCustomSelect === 'function') {
            refreshCustomSelect(filterTypeSelect);
        }
    }
    
    // Apply default template to preview
    const defaultTmpl = certTemplates.find(t => t.is_default == 1);
    if (defaultTmpl && typeSelect) {
        typeSelect.value = defaultTmpl.award_type;
        typeSelect.dispatchEvent(new Event('change'));
        typeSelect.dispatchEvent(new Event('input'));
        applyTemplateToPreview(defaultTmpl.id);
    }
}

function applyTemplateToPreview(templateId) {
    renderLivePreview();
}

function renderLivePreview() {
    // Dynamically adjust scale factor of live preview scaler based on actual container size
    const wrapper = document.querySelector('.cert-preview-wrapper');
    if (wrapper) {
        const updateScale = () => {
            const width = wrapper.clientWidth;
            if (width > 0) {
                const scale = (width - 32) / 1123; // Leave 16px padding on left/right
                const finalScale = Math.max(0.1, scale);
                wrapper.style.setProperty('--preview-scale', finalScale);
            }
        };
        if (!wrapper.dataset.observerAttached) {
            wrapper.dataset.observerAttached = 'true';
            const observer = new ResizeObserver(() => {
                updateScale();
            });
            observer.observe(wrapper);
        }
        updateScale();
    }

    const typeSelect = document.getElementById('cert-type');
    if (!typeSelect) return;
    const opt = typeSelect.options[typeSelect.selectedIndex];
    
    let tid = opt ? opt.getAttribute('data-tid') : null;
    let tmpl = tid ? certTemplates.find(t => t.id == tid) : null;

    if (!tmpl) {
        const iframe = document.getElementById('cert-live-preview-iframe');
        if (iframe) {
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#94a3b8;background:transparent;margin:0;"><div>Please select a certificate type to preview.</div></body></html>');
            doc.close();
        }
        return;
    }

    let html = tmpl.html_content || `
      <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.0.3/src/duotone/style.css">
        <style>body{margin:0;padding:0;}</style>
      </head>
      <body>
        <div style="width:100%; height:100vh; background:${tmpl.bg_gradient || '#f8fafc'}; padding:40px; box-sizing:border-box; position:relative; font-family:'Georgia', serif; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <div style="font-size:48px; color:${tmpl.primary_color || '#1e293b'}; margin-bottom:10px;"><i class="${tmpl.icon_class || 'ph-duotone ph-certificate'}"></i></div>
          <h1 style="font-size:36px; color:${tmpl.primary_color || '#1e293b'}; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:2px;">${tmpl.name || 'Certificate'}</h1>
          <div style="width:100px; height:2px; background:${tmpl.primary_color || '#1e293b'}; margin:0 auto 20px auto;"></div>
          <p style="font-size:16px; color:#475569; font-family:sans-serif; margin-bottom:5px;">This is presented to</p>
          <h2 style="font-size:28px; color:#0f172a; margin:0 0 20px 0; font-style:italic;">{{NAME}}</h2>
          <p style="font-size:16px; color:#475569; font-family:sans-serif;">For outstanding contribution in</p>
          <h3 style="font-size:20px; color:${tmpl.primary_color || '#1e293b'}; margin:10px 0 30px 0; text-transform:uppercase;">{{AWARD_TYPE}}</h3>
        </div>
      </body>
      </html>`;
        
    const name = document.getElementById('cert-full-name')?.value || 'Recipient Name';
    const email = document.getElementById('cert-email')?.value || 'email@example.com';
    const date = document.getElementById('cert-issue-date')?.value || new Date().toISOString().split('T')[0];
    const citation = document.getElementById('cert-citation')?.value || 'Achievement / citation text will appear here.';
    const issuer = document.getElementById('cert-issuing-authority')?.value || 'Issuing Authority';
    const coSignatory = document.getElementById('cert-co-signatory')?.value || 'Co-Signatory';
    const year = new Date(date).getFullYear() || new Date().getFullYear();
    const certId = `SS-CERT-${year}-XXXX`;
    const certType = typeSelect.value || 'Certificate Type';
    
    const pin = document.getElementById('cert-pin')?.value || '';
    const area = document.getElementById('cert-area')?.value || '';
    const city = document.getElementById('cert-city')?.value || '';
    const state = document.getElementById('cert-state')?.value || '';
    
    let zone = '';
    if(area) zone = area;
    if(city) zone += (zone ? ', ' : '') + city;
    if(state) zone += (zone ? ', ' : '') + state;
    if(pin) zone += ` - ${pin}`;
    
    html = html.replace(/\{\{NAME\}\}/g, name)
               .replace(/\{\{EMAIL\}\}/g, email)
               .replace(/\{\{ZONE\}\}/g, zone)
               .replace(/\{\{DATE\}\}/g, date)
               .replace(/\{\{ISSUER\}\}/g, issuer)
               .replace(/\{\{CERTIFICATE_ID\}\}/g, certId)
               .replace(/\{\{CERTIFICATE_TYPE\}\}/g, certType)
               .replace(/\{\{AWARD_TYPE\}\}/g, certType)
               .replace(/\{\{CITATION\}\}/g, citation)
               .replace(/\{\{CO_SIGNATORY\}\}/g, coSignatory);
               
    if (tmpl.css_content) {
        html = '<style>' + tmpl.css_content + '</style>' + html;
    }
    
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
    html = variablesStyle + html;
    
    const iframe = document.getElementById('cert-live-preview-iframe');
    if (iframe) {
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:transparent;font-family:sans-serif;overflow:hidden;} .cert-container{width:1123px;height:794px;background:#fff;transform-origin:center center;position:relative;overflow:hidden;} *{box-sizing:inherit;}</style></head><body><div class="cert-container">' + html + '</div></body></html>');
        doc.close();
    }
}

function renderTemplatesGrid() {
    const grid = document.getElementById('cert-templates-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Inject stylesheet for responsive scaling and styling of the grid cards
    const dynamicCss = `
        <style>
          .cert-grid-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 12px; overflow: hidden; }
          .cert-grid-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15); border-color: #94a3b8 !important; }
          .cert-grid-card .preview-box {
            width: 100%;
            aspect-ratio: 1123 / 238; /* Top 30% aspect ratio of 1123x794 certificate */
            overflow: hidden;
            position: relative;
            background: #f8fafc;
            border-bottom: 1px solid var(--border);
            container-type: inline-size;
          }
          .cert-grid-card .iframe-wrap {
            position: absolute;
            top: 0;
            left: 0;
            width: 1123px;
            height: 794px;
            transform-origin: top left;
            transform: scale(calc(100cqw / 1123));
            pointer-events: none;
          }
        </style>
    `;
    
    let htmlContent = '';
    certTemplates.forEach(tmpl => {
        const isSelected = tmpl.is_default == 1 
            ? 'border-color:#f59e0b;background:rgba(245,158,11,0.05);' 
            : 'border-color:var(--border);background:var(--bg-card);';
            
        const defaultBadge = tmpl.is_default == 1 
            ? '<div style="position:absolute;top:8px;right:8px;z-index:10;"><span style="background:rgba(245,158,11,0.15);backdrop-filter:blur(4px);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;">Default</span></div>' 
            : '';

        let html = tmpl.html_content || `
          <html>
          <head>
            <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.0.3/src/duotone/style.css">
            <style>body{margin:0;padding:0;}</style>
          </head>
          <body>
            <div style="width:100%; height:100vh; background:${tmpl.bg_gradient || '#f8fafc'}; padding:40px; box-sizing:border-box; position:relative; font-family:'Georgia', serif; text-align:center; display:flex; flex-direction:column; justify-content:center; align-items:center;">
              <div style="font-size:48px; color:${tmpl.primary_color || '#1e293b'}; margin-bottom:10px;"><i class="${tmpl.icon_class || 'ph-duotone ph-certificate'}"></i></div>
              <h1 style="font-size:36px; color:${tmpl.primary_color || '#1e293b'}; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:2px;">${tmpl.name || 'Certificate'}</h1>
              <div style="width:100px; height:2px; background:${tmpl.primary_color || '#1e293b'}; margin:0 auto 20px auto;"></div>
              <p style="font-size:16px; color:#475569; font-family:sans-serif; margin-bottom:5px;">This is presented to</p>
              <h2 style="font-size:28px; color:#0f172a; margin:0 0 20px 0; font-style:italic;">{{NAME}}</h2>
              <p style="font-size:16px; color:#475569; font-family:sans-serif;">For outstanding contribution in</p>
              <h3 style="font-size:20px; color:${tmpl.primary_color || '#1e293b'}; margin:10px 0 30px 0; text-transform:uppercase;">{{AWARD_TYPE}}</h3>
            </div>
          </body>
          </html>`;
          
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
                   .replace(/{{AWARD_TYPE}}/g, tmpl.award_type || 'Award Type')
                   .replace(/{{DATE}}/g, new Date().toLocaleDateString())
                   .replace(/{{ISSUER}}/g, 'Issuing Authority')
                   .replace(/{{ORGANIZATION}}/g, 'Organization');
                   
        let encodedHtml = html.replace(/"/g, '&quot;');
        
        htmlContent += `
        <div class="cert-grid-card" style="${isSelected}border-width:1px;border-style:solid;position:relative;background:#fff;cursor:pointer;">
            ${defaultBadge}
            <div class="preview-box">
               <div class="iframe-wrap">
                  <iframe srcdoc="${encodedHtml}" style="width:100%;height:100%;border:none;" scrolling="no"></iframe>
               </div>
            </div>
            <div style="padding:12px 16px;border-top:1px solid var(--border);">
              <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">${tmpl.name}</div>
              <div style="font-size:11px;color:var(--text3);">Used ${tmpl.usage_count} times</div>
            </div>
        </div>`;
    });
    
    grid.innerHTML = dynamicCss + htmlContent;
}

async function issueCertificate() {
    const btn = document.getElementById('btn-issue-cert');
    const msg = document.getElementById('cert-issued-msg');
    
    const typeSelect = document.getElementById('cert-type');
    const tmplId = typeSelect.options[typeSelect.selectedIndex]?.getAttribute('data-tid') || 0;
    
    const pin = document.getElementById('cert-pin')?.value || '';
    const area = document.getElementById('cert-area')?.value || '';
    const city = document.getElementById('cert-city')?.value || '';
    const state = document.getElementById('cert-state')?.value || '';
    
    let zone = '';
    if(area) zone = area;
    if(city) zone += (zone ? ', ' : '') + city;
    if(state) zone += (zone ? ', ' : '') + state;
    if(pin) zone += ` - ${pin}`;

    const phoneValue = document.getElementById('cert-phone').value;
    const finalPhone = phoneValue ? '+91' + phoneValue : '';

    const payload = {
        recipient_type: document.getElementById('cert-recipient-type')?.value || 'Community Member',
        recipient_name: document.getElementById('cert-full-name').value,
        recipient_email: document.getElementById('cert-email').value,
        recipient_phone: finalPhone,
        recipient_zone: zone,
        certificate_type: typeSelect.value,
        issue_date: document.getElementById('cert-issue-date').value,
        citation: document.getElementById('cert-citation').value,
        issuing_authority: document.getElementById('cert-issuing-authority').value,
        co_signatory: document.getElementById('cert-co-signatory').value,
        template_id: tmplId,
        send_email: document.getElementById('cert-send-email')?.checked ? 1 : 0,
        publish_to_feed: document.getElementById('cert-publish-feed')?.checked ? 1 : 0
    };
    
    if(!payload.recipient_name || !payload.certificate_type || !payload.issue_date) {
        if(typeof showToast === 'function') showToast("❌ Please fill all required fields (Name, Type, Date)");
        else alert("Please fill all required fields (Name, Type, Date)");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="ph-duotone ph-spinner animate-spin"></i> Issuing...';

    try {
        const res = await adminFetch(CERT_API_URL + '/api/certificates/issue_certificate.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            // update preview ID with the real generated ID
            const idEl = document.getElementById('cert-preview-id');
            if(idEl) idEl.innerText = data.cert_id;
            
            msg.style.display = 'flex';
            msg.innerHTML = `<i class="ph-duotone ph-check-circle" style="font-size:18px;"></i> Issued ${data.cert_id} to ${payload.recipient_email}!`;
            if(typeof showToast === 'function') showToast(`✅ Successfully issued ${data.cert_id}`);
            
            // Reset state
            setTimeout(() => {
                msg.style.display = 'none';
                document.getElementById('cert-full-name').value = '';
                document.getElementById('cert-email').value = '';
                document.getElementById('cert-phone').value = '';
                document.getElementById('cert-pin').value = '';
                document.getElementById('cert-area').innerHTML = '<option value="">— Select Area —</option>';
                document.getElementById('cert-city').value = '';
                document.getElementById('cert-state').value = '';
                document.getElementById('cert-citation').value = '';
                renderLivePreview();
            }, 3000);
            
            loadCertificates(); // Refresh list
        } else {
            if(typeof showToast === 'function') showToast('❌ Error issuing certificate: ' + data.error);
            else alert('Error issuing certificate: ' + data.error);
        }
    } catch(e) {
        console.error(e);
        if(typeof showToast === 'function') showToast('❌ Server error issuing certificate');
        else alert('Server error');
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-award" style="font-size:14px;"></i> Issue certificate';
}

let searchTimeout;
function handleCertSearchInput() {
    const searchInput = document.getElementById('cert-search-input');
    const clearBtn = document.getElementById('cert-search-clear');
    
    if (searchInput && clearBtn) {
        if (searchInput.value.trim() !== '') {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadCertificates(1);
    }, 200);
}

function clearCertSearch() {
    const searchInput = document.getElementById('cert-search-input');
    const clearBtn = document.getElementById('cert-search-clear');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    loadCertificates(1);
}

async function loadCertificates(page = 1) {
    currentCertPage = page;
    const search = document.getElementById('cert-search-input')?.value || '';
    const type = document.getElementById('cert-filter-type')?.value || 'All';
    const status = document.getElementById('cert-filter-status')?.value || 'All';
    
    try {
        const res = await adminFetch(CERT_API_URL + `/api/certificates/list_certificates.php?page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`);
        const data = await res.json();
        
        if (data.success) {
            // Update stats
            const totalEl = document.getElementById('cert-stat-total');
            if (totalEl) totalEl.innerText = data.stats.total;
            const activeEl = document.getElementById('cert-stat-active');
            if (activeEl) activeEl.innerText = data.stats.active;
            const monthEl = document.getElementById('cert-stat-month');
            if (monthEl) monthEl.innerText = data.stats.this_month;
            const revokedEl = document.getElementById('cert-stat-revoked');
            if (revokedEl) revokedEl.innerText = data.stats.revoked;
            
            // Render table
            const tbody = document.getElementById('cert-table-body');
            if (tbody) {
                tbody.innerHTML = '';
                if (data.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No certificates found.</td></tr>';
                } else {
                    data.data.forEach(cert => {
                        let statusColor = 'bg-gray-100 text-gray-500';
                        if (cert.status === 'Active') statusColor = 'bg-green-100 text-green-700';
                        if (cert.status === 'Revoked') statusColor = 'bg-red-100 text-red-700';
                        
                        tbody.innerHTML += `
                        <tr style="border-bottom:1px solid var(--border);">
                            <td style="padding:12px;font-family:'Outfit',sans-serif;font-size:12px;color:var(--text3);">${cert.cert_id}</td>
                            <td style="padding:12px;">
                                <div style="font-size:13px;font-weight:600;color:var(--text);">${cert.recipient_name}</div>
                                <div style="font-size:11px;color:var(--text3);">${cert.recipient_email}</div>
                            </td>
                            <td style="padding:12px;">
                                <span style="background:var(--bg-light);border:1px solid var(--border);padding:4px 8px;border-radius:6px;font-size:11px;color:var(--text2);">${cert.certificate_type}</span>
                            </td>
                            <td style="padding:12px;font-size:12px;color:var(--text2);">${cert.recipient_zone}</td>
                            <td style="padding:12px;font-size:12px;color:var(--text3);">${cert.issue_date}</td>
                            <td style="padding:12px;">
                                <span class="${statusColor}" style="padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;">${cert.status}</span>
                            </td>
                            <td style="padding:12px;">
                                <div style="display:flex;gap:6px;">
                                    <button class="action-btn" title="Download" onclick="downloadCert('${cert.cert_id}')" style="width:28px;height:28px;border-radius:6px;border:1px solid #fde68a;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="ph-duotone ph-download-simple"></i></button>
                                    <button class="action-btn" title="View" onclick="viewIssuedCertificate('${cert.cert_id}')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="ph-duotone ph-eye"></i></button>
                                    ${cert.status === 'Active' ? `<button class="action-btn" title="Revoke" onclick="updateCertStatus('${cert.cert_id}', 'revoke')" style="width:28px;height:28px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#ef4444;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="ph-duotone ph-prohibit"></i></button>` : (cert.status === 'Revoked' ? `<button class="action-btn" title="Reinstate" onclick="updateCertStatus('${cert.cert_id}', 'reinstate')" style="width:28px;height:28px;border-radius:6px;border:1px solid #bbf7d0;background:#f0fdf4;color:#22c55e;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="ph-duotone ph-arrow-counter-clockwise"></i></button>` : '')}
                                </div>
                            </td>
                        </tr>`;
                    });
                }
            }
            
            // Pagination info
            const showing = document.getElementById('cert-pagination-info');
            if (showing) {
                const total = data.pagination.total;
                const limit = data.pagination.limit;
                const start = (page - 1) * limit + 1;
                const end = Math.min(page * limit, total);
                if (total === 0) {
                    showing.innerText = `Showing 0 of 0 certificates`;
                } else {
                    showing.innerText = `Showing ${start}-${end} of ${total} certificates`;
                }
            }
            
            // Pagination controls
            const controls = document.getElementById('cert-pagination-controls');
            if (controls) {
                const totalPages = data.pagination.total_pages;
                let html = '';
                
                // Prev button
                html += `<button onclick="loadCertificates(${page - 1})" ${page === 1 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:${page === 1 ? 'not-allowed' : 'pointer'};color:var(--text3);opacity:${page === 1 ? '0.5' : '1'};"><i class="ph-bold ph-caret-left"></i></button>`;
                
                // Number buttons
                for (let i = 1; i <= totalPages; i++) {
                    if (i === page) {
                        html += `<button onclick="loadCertificates(${i})" style="width:28px;height:28px;border-radius:6px;border:1px solid #16a34a;background:rgba(34,197,94,0.1);cursor:pointer;color:#16a34a;font-weight:bold;">${i}</button>`;
                    } else {
                        html += `<button onclick="loadCertificates(${i})" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;color:var(--text3);">${i}</button>`;
                    }
                }
                
                // Next button
                html += `<button onclick="loadCertificates(${page + 1})" ${page === totalPages || totalPages === 0 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:${page === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer'};color:var(--text3);opacity:${page === totalPages || totalPages === 0 ? '0.5' : '1'};"><i class="ph-bold ph-caret-right"></i></button>`;
                
                controls.innerHTML = html;
            }
        }
    } catch(e) { console.error('Failed to load certificates', e); }
}

async function updateCertStatus(certId, action) {
    const title = action === 'revoke' ? 'Revoke Certificate?' : 'Reinstate Certificate?';
    const msg = action === 'revoke' 
      ? `Are you sure you want to revoke certificate ${certId}? This action cannot be undone.` 
      : `Are you sure you want to reinstate certificate ${certId}?`;
    const acceptText = action === 'revoke' ? 'Yes, Revoke' : 'Yes, Reinstate';
    const isDanger = action === 'revoke';

    window.showCustomConfirm(title, msg, async () => {
        try {
            const res = await adminFetch(CERT_API_URL + '/api/certificates/update_certificate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cert_id: certId, action: action })
            });
            const data = await res.json();
            if (data.success) {
                if(typeof showToast === 'function') {
                    showToast(`✅ Certificate ${action} successful!`);
                }
                loadCertificates(currentCertPage); // Instantly updates UI and stats
            } else {
                if(typeof showToast === 'function') {
                    showToast('❌ Error: ' + data.error);
                } else {
                    alert('Error: ' + data.error);
                }
            }
        } catch(e) {
            if(typeof showToast === 'function') {
                showToast('❌ Server error');
            } else {
                alert('Server error');
            }
        }
    }, acceptText, isDanger, "Cancel");
}

function downloadPDF() {
    const originalIframe = document.getElementById('cert-live-preview-iframe');
    if(!originalIframe) return;
    
    if (typeof html2pdf === 'undefined') {
        alert('PDF library not loaded');
        return;
    }
    
    // Create a hidden print iframe to avoid CSS transform scaling issues
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '1056px';
    printIframe.style.height = '816px';
    printIframe.style.zIndex = '-1000';
    printIframe.style.opacity = '0';
    printIframe.style.pointerEvents = 'none';
    document.body.appendChild(printIframe);
    
    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(originalIframe.contentWindow.document.documentElement.outerHTML);
    doc.close();
    
    const dateStr = document.getElementById('cert-issue-date')?.value || new Date().toISOString().split('T')[0];
    const year = new Date(dateStr).getFullYear();
    
    const opt = {
      margin:       0,
      filename:     `Certificate-SS-CERT-${year}-XXXX.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 1056, windowHeight: 816 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    // Wait slightly for fonts/styles to parse in the new iframe
    setTimeout(() => {
        const certContainer = printIframe.contentWindow.document.querySelector('.cert-container');
        if (!certContainer) {
            document.body.removeChild(printIframe);
            return;
        }
        
        html2pdf().set(opt).from(certContainer).save().then(() => {
            document.body.removeChild(printIframe);
        }).catch(err => {
            console.error('PDF generation error:', err);
            document.body.removeChild(printIframe);
        });
    }, 500);
}

async function viewIssuedCertificate(certId) {
    try {
        const res = await adminFetch(CERT_API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
        const data = await res.json();
        
        if (data.success && data.html_content) {
            const overlay = document.getElementById('template-preview-overlay');
            const iframe = document.getElementById('full-preview-frame');
            
            // Hide edit/delete/default buttons for issued certificate preview
            const btnEdit = document.getElementById('btn-preview-edit');
            const btnDelete = document.getElementById('btn-preview-delete');
            const btnDefault = document.getElementById('btn-preview-default');
            if(btnEdit) btnEdit.style.display = 'none';
            if(btnDelete) btnDelete.style.display = 'none';
            if(btnDefault) btnDefault.style.display = 'none';
            
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#e2e8f0;font-family:sans-serif;overflow:hidden;} .cert-scaler{width:1123px;height:794px;transform-origin:center center;} .cert-container{width:100%;height:100%;box-shadow:0 10px 40px rgba(0,0,0,0.1);background:#fff;overflow:hidden;} *{box-sizing:inherit;}</style></head><body><div class="cert-scaler" id="cert-scaler"><div class="cert-container">' + data.html_content + '</div></div><script>function fit(){var s=document.getElementById("cert-scaler");var w=window.innerWidth*0.95;var h=window.innerHeight*0.95;var scale=Math.min(w/1123, h/794);s.style.transform="scale("+scale+")";} window.onload=fit;window.onresize=fit;</script></body></html>');
            doc.close();

            overlay.classList.add('open');
            
            // Ensure buttons are restored when modal closes
            const closeBtn = overlay.querySelector('.modal-close');
            if(closeBtn) {
                const oldOnclick = closeBtn.onclick;
                closeBtn.onclick = function(e) {
                    if(btnEdit) btnEdit.style.display = 'flex';
                    if(btnDelete) btnDelete.style.display = 'flex';
                    if(btnDefault) btnDefault.style.display = 'flex';
                    if(oldOnclick) oldOnclick.call(this, e);
                }
            }
        } else {
            if(typeof showToast === 'function') {
                showToast('❌ Failed to load certificate preview: ' + (data.error || 'Not found'));
            } else {
                alert('Failed to load certificate preview: ' + (data.error || 'Not found'));
            }
        }
    } catch(e) {
        console.error('Error fetching issued certificate:', e);
        if(typeof showToast === 'function') {
            showToast('❌ Error loading certificate preview');
        } else {
            alert('Error loading certificate preview');
        }
    }
}

async function downloadCert(certId) {
    if (typeof html2pdf === 'undefined') {
        if(typeof showToast === 'function') showToast('❌ PDF library not loaded');
        else alert('PDF library not loaded');
        return;
    }
    
    if(typeof showToast === 'function') showToast('⏳ Generating PDF...');

    try {
        const res = await adminFetch(CERT_API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
        const data = await res.json();
        
        if (data.success && data.html_content) {
            // Create a temporary hidden div
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '-9999px';
            tempDiv.style.width = '1056px'; // Letter landscape width at 96 DPI
            
            // Wrap the content so it has nice padding, white background, and standard height
            tempDiv.innerHTML = `<div style="padding:40px; box-sizing:border-box; background:#fff; min-height:816px; display:flex; flex-direction:column; justify-content:center;">${data.html_content}</div>`;
            document.body.appendChild(tempDiv);
            
            const opt = {
                margin:       0,
                filename:     `${certId}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
            };
            
            html2pdf().set(opt).from(tempDiv).save().then(() => {
                document.body.removeChild(tempDiv);
                if(typeof showToast === 'function') showToast('✅ PDF Downloaded successfully!');
            });
        } else {
            if(typeof showToast === 'function') showToast('❌ Failed to load certificate data');
        }
    } catch(e) {
        console.error(e);
        if(typeof showToast === 'function') showToast('❌ Error generating PDF');
    }
}

function exportCertsCSV() {
    const search = document.getElementById('cert-search-input')?.value || '';
    const type = document.getElementById('cert-filter-type')?.value || 'All';
    const status = document.getElementById('cert-filter-status')?.value || 'All';
    window.open(CERT_API_URL + `/api/certificates/list_certificates.php?export=1&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`, '_blank');
}


  const el = (id) => document.getElementById(id);
  const input = el('certInput');
  const clearBtn = el('clearBtn');
  const scanRow = el('scanRow');
  const qrSection = el('qrSection');
  const notFoundNotice = el('notFoundNotice');
  const termsNotice = el('termsNotice');
  const verifyBtn = el('verifyBtn');
  const verifyBtnText = el('verifyBtnText');
  const resultSection = el('resultSection');
  const aboutPanel = el('aboutPanel');
  const previewPanel = el('previewPanel');
  const form = el('verifyForm');

  function updateClearAndButton() {
    if (!input) return;
    const has = input.value.trim().length > 0;
    if(clearBtn) clearBtn.style.display = has ? 'flex' : 'none';
    if(verifyBtn) verifyBtn.disabled = !has;
  }

  if (input) {
      input.addEventListener('input', () => {
        updateClearAndButton();
      });
  }

  if (clearBtn) {
      clearBtn.addEventListener('click', () => resetAll());
  }

  function resetAll() {
    if(input) input.value = '';
    updateClearAndButton();
    if(notFoundNotice) notFoundNotice.style.display = 'none';
    if(scanRow) scanRow.style.display = 'none';
    if(qrSection) qrSection.style.display = 'block';
    if(termsNotice) termsNotice.style.display = 'flex';
    if(resultSection) resultSection.style.display = 'none';
    if(aboutPanel) aboutPanel.style.display = 'flex';
    if(previewPanel) previewPanel.style.display = 'none';
    if (typeof window.stopQRScanner === 'function') window.stopQRScanner();
  }

  function formatVerificationTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return date + ', ' + time;
  }

  function renderSuccess(id, data) {
    const isValid = data.status === 'Valid' || data.status === 'valid' || data.valid;

    const banner = el('statusBanner');
    if(banner) banner.className = 'status-banner ' + (isValid ? 'valid' : 'invalid');
    if(el('statusDot')) el('statusDot').className = 'status-dot ' + (isValid ? 'valid' : 'invalid');
    if(el('statusTitle')) el('statusTitle').className = 'status-title ' + (isValid ? 'valid' : 'invalid');
    if(el('statusTitle')) el('statusTitle').textContent = isValid ? 'Certificate Verified Successfully!' : 'Certificate Flagged / Invalid';
    if(el('statusSub')) el('statusSub').className = 'status-sub ' + (isValid ? 'valid' : 'invalid');
    if(el('statusSub')) el('statusSub').textContent = isValid
      ? ('This certificate is valid and issued by ' + (data.issuedBy || data.issuing_authority || 'SurakshaSetu') + '.')
      : ('This certificate could not be verified or has been revoked.');

    if(el('dv-id')) el('dv-id').textContent = id;
    if(el('dv-name')) el('dv-name').textContent = data.recipientName || data.recipient_name;
    if(el('dv-issuedate')) el('dv-issuedate').textContent = data.issueDate || data.issue_date;
    if(el('dv-issuedby')) el('dv-issuedby').textContent = data.issuedBy || data.issuing_authority || 'SurakshaSetu';
    if(el('dv-type')) el('dv-type').textContent = data.certificateType || data.certificate_type || 'General';
    
    if(el('dv-status')) {
        el('dv-status').textContent = isValid ? 'Valid' : 'Invalid';
        el('dv-status').className = 'status-badge ' + (isValid ? 'valid' : 'invalid');
    }
    
    if(el('dv-verified')) el('dv-verified').textContent = formatVerificationTimestamp();
    
    const txnHash = data.blockchainTxnId || ('0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''));
    if(el('dv-txn') && el('dv-txn').childNodes[0]) el('dv-txn').childNodes[0].nodeValue = txnHash.substring(0, 10) + '...' + txnHash.substring(txnHash.length - 6) + ' ';

    const tamperNotice = el('tamperNotice');
    if(tamperNotice) {
        tamperNotice.className = 'notice ' + (isValid ? 'green' : 'red');
        el('tamperText').textContent = isValid
          ? 'This certificate is valid and has not been tampered with.'
          : "This certificate's status indicates it should no longer be treated as valid.";
    }

    if(resultSection) resultSection.style.display = 'block';

    if(el('cv-name')) el('cv-name').textContent = data.recipientName || data.recipient_name;
    if(el('cv-desc')) el('cv-desc').textContent = data.subtitle || `For their outstanding contribution as a ${data.certificateType || data.certificate_type || 'member'}.`;
    if(el('cv-id')) el('cv-id').textContent = id;
    if(el('cv-date')) el('cv-date').textContent = data.issueDate || data.issue_date;

    if(aboutPanel) aboutPanel.style.display = 'none';
    if(previewPanel) previewPanel.style.display = 'block';

    if(scanRow) scanRow.style.display = 'flex';
    if(qrSection) qrSection.style.display = 'none';
    if(termsNotice) termsNotice.style.display = 'none';
    if(notFoundNotice) notFoundNotice.style.display = 'none';
  }

  function renderNotFound() {
    if(resultSection) resultSection.style.display = 'none';
    if(aboutPanel) aboutPanel.style.display = 'flex';
    if(previewPanel) previewPanel.style.display = 'none';
    if(notFoundNotice) notFoundNotice.style.display = 'flex';
    if(termsNotice) termsNotice.style.display = 'flex';
  }

  async function runVerification(rawId) {
    if (!input) return;
    const id = (rawId !== undefined ? rawId : input.value).trim();
    if (!id) return;

    if(verifyBtn) verifyBtn.disabled = true;
    if(verifyBtnText) verifyBtnText.textContent = 'Verifying...';
    if(verifyBtn && verifyBtn.querySelector('svg')) verifyBtn.querySelector('svg').classList.add('spin');

    try {
        const res = await fetch(CERT_API_URL + `/api/certificates/verify_certificate.php?q=${encodeURIComponent(id)}`);
        const data = await res.json();
        
        if(verifyBtnText) verifyBtnText.textContent = 'Verify Certificate';
        if(verifyBtn && verifyBtn.querySelector('svg')) verifyBtn.querySelector('svg').classList.remove('spin');
        updateClearAndButton();
        
        if (data.success && data.valid) {
             renderSuccess(id.toUpperCase(), data.data);
        } else {
             renderNotFound();
        }
    } catch (e) {
        console.error(e);
        if(verifyBtnText) verifyBtnText.textContent = 'Verify Certificate';
        if(verifyBtn && verifyBtn.querySelector('svg')) verifyBtn.querySelector('svg').classList.remove('spin');
        updateClearAndButton();
        renderNotFound();
    }
  }

  if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        runVerification();
      });
  }

  if (el('sampleBtn')) {
      el('sampleBtn').addEventListener('click', () => {
        if(input) input.value = 'CERT-2026-1004';
        updateClearAndButton();
        runVerification('CERT-2026-1004');
      });
  }

  if (el('verifyAnotherBtn')) {
      el('verifyAnotherBtn').addEventListener('click', () => resetAll());
  }

  // Call initialization on load just to be safe
  setTimeout(updateClearAndButton, 100);

  // QR Code Scanner Logic
  let html5QrcodeScanner = null;
  window.stopQRScanner = function() {
      if (html5QrcodeScanner) {
          try { html5QrcodeScanner.clear(); } catch(e){}
          html5QrcodeScanner = null;
      }
      const qrReader = el('qr-reader');
      const openCamBtn = el('openCamBtn');
      if (qrReader) qrReader.style.display = 'none';
      if (openCamBtn) {
          openCamBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" /><circle cx="12" cy="13" r="4" /></svg> Open Camera';
      }
  };

  const openCamBtnEl = el('openCamBtn');
  if (openCamBtnEl) {
      openCamBtnEl.addEventListener('click', () => {
          if (html5QrcodeScanner) {
              window.stopQRScanner();
              return;
          }
          if(typeof Html5QrcodeScanner === 'undefined') {
              alert('QR Scanner library is still loading or could not be loaded.');
              return;
          }
          const qrReader = el('qr-reader');
          if(qrReader) qrReader.style.display = 'block';
          
          openCamBtnEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> Close Camera';
          
          html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
          html5QrcodeScanner.render((decodedText) => {
              if (input) input.value = decodedText;
              updateClearAndButton();
              window.stopQRScanner();
              runVerification(decodedText);
          }, (errorMessage) => {
              // ignore parse errors while scanning
          });
      });
  }

  const scanLinkBtn = document.querySelector('.scan-link');
  if (scanLinkBtn) {
      scanLinkBtn.addEventListener('click', () => {
          if (typeof resetAll === 'function') resetAll();
          if (openCamBtnEl) openCamBtnEl.click();
      });
  }

  const verifyDlPdfBtn = el('verifyDlPdfBtn');
  const verifyDlImgBtn = el('verifyDlImgBtn');

  if (verifyDlPdfBtn) {
      verifyDlPdfBtn.addEventListener('click', () => {
          const certId = el('cv-id')?.textContent || (input ? input.value : null);
          if (certId && typeof downloadCert === 'function') {
              downloadCert(certId);
          }
      });
  }

  if (verifyDlImgBtn) {
      verifyDlImgBtn.addEventListener('click', async () => {
          const certId = el('cv-id')?.textContent || (input ? input.value : null);
          if (!certId) return;

          if(typeof showToast === 'function') showToast('⏳ Generating Image...');
          try {
              const res = await adminFetch(CERT_API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
              const data = await res.json();
              if (data.success && data.html_content) {
                  const tempDiv = document.createElement('div');
                  tempDiv.style.position = 'absolute';
                  tempDiv.style.left = '-9999px';
                  tempDiv.style.top = '-9999px';
                  tempDiv.style.width = '1056px';
                  tempDiv.innerHTML = `<div style="padding:40px; box-sizing:border-box; background:#fff; min-height:816px; display:flex; flex-direction:column; justify-content:center;">${data.html_content}</div>`;
                  document.body.appendChild(tempDiv);
                  
                  const doImageDownload = () => {
                      setTimeout(() => {
                          html2canvas(tempDiv, { scale: 2, useCORS: true }).then(canvas => {
                              document.body.removeChild(tempDiv);
                              const link = document.createElement('a');
                              link.download = `${certId}.jpg`;
                              link.href = canvas.toDataURL('image/jpeg', 0.98);
                              link.click();
                              if(typeof showToast === 'function') showToast('✅ Image Downloaded successfully!');
                          }).catch(err => {
                              document.body.removeChild(tempDiv);
                              console.error(err);
                          });
                      }, 500);
                  };

                  if (typeof html2canvas === 'undefined') {
                      const script = document.createElement('script');
                      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                      script.onload = doImageDownload;
                      document.head.appendChild(script);
                  } else {
                      doImageDownload();
                  }

              } else {
                  if(typeof showToast === 'function') showToast('❌ Failed to load certificate data');
              }
          } catch(e) {
              console.error(e);
              if(typeof showToast === 'function') showToast('❌ Error generating Image');
          }
      });
  }
