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

    // Bind preview live updates
    const bindPreview = (inputId, previewId, fallback) => {
        const input = document.getElementById(inputId);
        if(input) {
            input.addEventListener('input', (e) => {
                const el = document.getElementById(previewId);
                if(el) el.innerText = e.target.value || fallback;
            });
        }
    };
    
    bindPreview('cert-full-name', 'cert-preview-name', 'Recipient Name');
    bindPreview('cert-type', 'cert-preview-type', 'Certificate Type');
    bindPreview('cert-citation', 'cert-preview-citation', 'Achievement / citation text will appear here.');
    bindPreview('cert-issue-date', 'cert-preview-date', 'Date');
    bindPreview('cert-issuing-authority', 'cert-preview-auth1', 'Issuing Authority');
    bindPreview('cert-co-signatory', 'cert-preview-auth2', 'Co-Signatory');
    
    // Prefix handling
    const prefixInput = document.getElementById('cert-id-prefix');
    if (prefixInput) {
        prefixInput.addEventListener('input', updatePreviewId);
    }

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
                    document.getElementById('cert-phone').value = member.phone || '';
                    document.getElementById('cert-zone').value = member.zone || 'All of Agra';
                    
                    // Trigger input event to update preview
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
        dateInput.dispatchEvent(new Event('input'));
        updatePreviewId();
    }
}

function updatePreviewId() {
    const prefix = document.getElementById('cert-id-prefix')?.value || 'SS-CERT';
    const dateStr = document.getElementById('cert-issue-date')?.value || new Date().toISOString().split('T')[0];
    const year = new Date(dateStr).getFullYear();
    const el = document.getElementById('cert-preview-id');
    if(el) el.innerText = `${prefix}-${year}-XXXX`;
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
            }
        }
    } catch(e) { console.error('Failed to load members', e); }
}

async function loadTemplates() {
    try {
        const res = await fetch(API_URL + '/api/certificates/get_templates.php');
        const data = await res.json();
        if (data.success) {
            certTemplates = data.data;
            renderTemplatesGrid();
            
            // Populate types dropdown
            const typeSelect = document.getElementById('cert-type');
            const filterTypeSelect = document.getElementById('cert-filter-type');
            
            if (typeSelect) {
                typeSelect.innerHTML = '<option value="">— Select Type —</option>';
                certTemplates.forEach(t => {
                    typeSelect.innerHTML += `<option value="${t.award_type}" data-tid="${t.id}">${t.award_type}</option>`;
                });
                
                typeSelect.addEventListener('change', (e) => {
                    // Update preview style based on selected template
                    const opt = e.target.options[e.target.selectedIndex];
                    const tid = opt.getAttribute('data-tid');
                    applyTemplateToPreview(tid);
                });
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
                typeSelect.dispatchEvent(new Event('input'));
                applyTemplateToPreview(defaultTmpl.id);
            }
        }
    } catch(e) { console.error('Failed to load templates', e); }
}

function applyTemplateToPreview(templateId) {
    const tmpl = certTemplates.find(t => t.id == templateId);
    if (!tmpl) return;
    
    const card = document.getElementById('cert-preview-card');
    const icon = document.getElementById('cert-preview-icon');
    const title = document.getElementById('cert-preview-title');
    
    if (card) {
        card.style.background = tmpl.bg_gradient;
    }
    if (title) {
        title.innerText = tmpl.name || 'Certificate of Excellence';
        title.style.color = tmpl.primary_color;
    }
    if (icon) {
        icon.className = tmpl.icon_class;
        icon.style.color = tmpl.primary_color;
        // The parent circle of icon
        if(icon.parentElement) {
            icon.parentElement.style.borderColor = tmpl.primary_color;
            // set low opacity background
            icon.parentElement.style.background = tmpl.primary_color.replace(')', ', 0.1)').replace('rgb', 'rgba'); 
        }
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
    
    const payload = {
        recipient_type: document.getElementById('cert-recipient-type')?.value || 'Community Member',
        recipient_name: document.getElementById('cert-full-name').value,
        recipient_email: document.getElementById('cert-email').value,
        recipient_phone: document.getElementById('cert-phone').value,
        recipient_zone: document.getElementById('cert-zone').value,
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
                document.getElementById('cert-citation').value = '';
                document.getElementById('cert-preview-name').innerText = 'Recipient Name';
                document.getElementById('cert-preview-citation').innerText = 'Achievement / citation text will appear here.';
                updatePreviewId();
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
    const card = document.getElementById('cert-preview-card');
    if(!card) return;
    
    // Check if html2pdf is loaded
    if (typeof html2pdf === 'undefined') {
        alert('PDF library not loaded');
        return;
    }
    
    const opt = {
      margin:       0.5,
      filename:     `Certificate-${document.getElementById('cert-preview-id').innerText}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(card).save();
}

async function viewIssuedCertificate(certId) {
    try {
        const res = await fetch(API_URL + `/api/certificates/get_issued_certificate.php?id=${encodeURIComponent(certId)}`);
        const data = await res.json();
        
        if (data.success && data.html_content) {
            const overlay = document.getElementById('template-preview-overlay');
            const iframe = document.getElementById('full-preview-frame');
            
            // Hide edit/delete buttons for issued certificate preview
            const btnEdit = document.getElementById('btn-preview-edit');
            const btnDelete = document.getElementById('btn-preview-delete');
            if(btnEdit) btnEdit.style.display = 'none';
            if(btnDelete) btnDelete.style.display = 'none';
            
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
