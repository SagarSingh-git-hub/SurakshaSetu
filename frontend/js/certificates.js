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

async function loadTemplates() {
    try {
        const res = await fetch(API_URL + '/api/certificates/get_templates.php');
        const data = await res.json();
        if (data.success) {
            certTemplates = data.templates || data.data || [];
            renderTemplatesGrid();
            
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
    } catch(e) { console.error('Failed to load templates', e); }
}

function applyTemplateToPreview(templateId) {
    renderLivePreview();
}

function renderLivePreview() {
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
        <div style="padding:40px; font-family:sans-serif; text-align:center;">
          <h1 style="color:#059669;">Certificate of Achievement</h1>
          <p>This is presented to</p>
          <h2 style="color:#1e293b;">{{NAME}}</h2>
          <p>For {{AWARD_TYPE}}</p>
        </div>`;
        
    const name = document.getElementById('cert-full-name')?.value || 'Recipient Name';
    const email = document.getElementById('cert-email')?.value || 'email@example.com';
    const date = document.getElementById('cert-issue-date')?.value || new Date().toISOString().split('T')[0];
    const citation = document.getElementById('cert-citation')?.value || 'Achievement / citation text will appear here.';
    const issuer = document.getElementById('cert-issuing-authority')?.value || 'Issuing Authority';
    const coSignatory = document.getElementById('cert-co-signatory')?.value || 'Co-Signatory';
    const prefix = document.getElementById('cert-id-prefix')?.value || 'SS-CERT';
    const year = new Date(date).getFullYear() || new Date().getFullYear();
    const certId = `${prefix}-${year}-XXXX`;
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
    
    const iframe = document.getElementById('cert-live-preview-iframe');
    if (iframe) {
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:transparent;font-family:sans-serif;} .cert-container{width:100%;max-width:900px;background:#fff;transform-origin:center center;} *{box-sizing:inherit;}</style></head><body><div class="cert-container">' + html + '</div></body></html>');
        doc.close();
    }
}

function renderTemplatesGrid() {
    const grid = document.getElementById('cert-templates-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    certTemplates.forEach(tmpl => {
        const isSelected = tmpl.is_default == 1 ? 'border-color:#f59e0b;background:rgba(245,158,11,0.05);' : 'border-color:var(--border);background:var(--bg-card);';
        const defaultBadge = tmpl.is_default == 1 ? '<div style="position:absolute;top:8px;right:8px;"><span style="background:rgba(245,158,11,0.12);color:#f59e0b;font-size:10px;padding:2px 8px;border-radius:8px;">Default</span></div>' : '';
        
        grid.innerHTML += `
        <div style="${isSelected}border-width:1px;border-style:solid;border-radius:12px;overflow:hidden;transition:all .2s;">
            <div style="height:110px;display:flex;align-items:center;justify-content:center;position:relative;background:${tmpl.bg_gradient};">
              <div style="text-align:center;padding:12px;">
                <div style="font-family:'Georgia',serif;font-size:14px;color:${tmpl.primary_color};margin-bottom:4px;font-weight:700;">Certificate of Excellence</div>
                <div style="font-size:10px;color:var(--text3);">${tmpl.award_type}</div>
                <div style="margin-top:8px;width:28px;height:28px;border-radius:50%;border:1px solid ${tmpl.primary_color};display:flex;align-items:center;justify-content:center;margin-left:auto;margin-right:auto;">
                    <i class="${tmpl.icon_class}" style="font-size:14px;color:${tmpl.primary_color};"></i>
                </div>
              </div>
              ${defaultBadge}
            </div>
            <div style="padding:12px 16px;border-top:1px solid var(--border);">
              <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">${tmpl.name}</div>
              <div style="font-size:11px;color:var(--text3);">Used ${tmpl.usage_count} times</div>
            </div>
        </div>`;
    });
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
        prefix: document.getElementById('cert-id-prefix').value,
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
        const res = await fetch(API_URL + '/api/certificates/issue_certificate.php', {
            method: 'POST',
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
    btn.innerHTML = '<i class="ph-bold ph-award" style="font-size:16px;"></i> Issue certificate';
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
        const res = await fetch(API_URL + `/api/certificates/list_certificates.php?page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`);
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
    if(!confirm(`Are you sure you want to ${action} certificate ${certId}?`)) return;
    
    try {
        const res = await fetch(API_URL + '/api/certificates/update_certificate.php', {
            method: 'POST',
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
}

function downloadPDF() {
    const iframe = document.getElementById('cert-live-preview-iframe');
    if(!iframe) return;
    
    // Check if html2pdf is loaded
    if (typeof html2pdf === 'undefined') {
        alert('PDF library not loaded');
        return;
    }
    
    const iframeDoc = iframe.contentWindow.document;
    const certContainer = iframeDoc.querySelector('.cert-container');
    if (!certContainer) return;
    
    // Need to clone the container and render it properly for PDF
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '1056px';
    
    tempDiv.innerHTML = `<div style="padding:40px; box-sizing:border-box; background:#fff; min-height:816px; display:flex; flex-direction:column; justify-content:center;">${certContainer.innerHTML}</div>`;
    
    // Inject styles from iframe to main document for html2pdf to catch
    const styles = iframeDoc.querySelectorAll('style');
    styles.forEach(style => {
        const newStyle = document.createElement('style');
        newStyle.innerHTML = style.innerHTML;
        tempDiv.appendChild(newStyle);
    });
    
    document.body.appendChild(tempDiv);
    
    const dateStr = document.getElementById('cert-issue-date')?.value || new Date().toISOString().split('T')[0];
    const year = new Date(dateStr).getFullYear();
    const prefix = document.getElementById('cert-id-prefix')?.value || 'SS-CERT';
    
    const opt = {
      margin:       0,
      filename:     `Certificate-${prefix}-${year}-XXXX.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(tempDiv).save().then(() => {
        document.body.removeChild(tempDiv);
    });
}

async function viewIssuedCertificate(certId) {
    try {
        const res = await fetch(API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
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
            doc.write('<html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#e2e8f0;font-family:sans-serif;} .cert-container{box-shadow:0 10px 40px rgba(0,0,0,0.1);background:#fff;max-width:95%;max-height:95%;overflow:hidden;transform-origin:center center;} *{box-sizing:inherit;}</style></head><body><div class="cert-container">' + data.html_content + '</div></body></html>');
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
        const res = await fetch(API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
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
    window.open(API_URL + `/api/certificates/list_certificates.php?export=1&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`, '_blank');
}
