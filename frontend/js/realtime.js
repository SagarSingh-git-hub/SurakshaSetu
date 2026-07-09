// ── REAL-TIME WEBSOCKETS (PUSHER) ──

const PUSHER_KEY = '850e64cc0944f72172df';
const PUSHER_CLUSTER = 'ap2';

let pusher = null;
let channel = null;

function initRealtime() {
    if (PUSHER_KEY === 'YOUR_APP_KEY') {
        console.warn("Pusher is not configured. Real-time updates are disabled.");
        return;
    }

    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        console.log("Realtime: No admin session token found. Postponing websocket connection.");
        return;
    }

    if (pusher) {
        console.log("Realtime: Already initialized.");
        return;
    }

    Pusher.logToConsole = false;

    // Initialize Pusher pointing to secure auth endpoint
    pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        authEndpoint: `${API_URL}/api/pusher_auth.php`,
        auth: {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }
    });

    // Subscribe to secure private channel
    channel = pusher.subscribe('private-eco-channel');

    // Handle subscription authentication failures
    pusher.connection.bind('error', function(err) {
        if (err && err.error && err.error.data && err.error.data.code === 401) {
            console.error("Realtime subscription unauthorized. Disconnecting...", err);
            destroyRealtime();
        }
    });

    // Handle connection state changes for resilience
    pusher.connection.bind('state_change', function(states) {
        console.log(`Pusher State changed: ${states.previous} -> ${states.current}`);
        if (states.current === 'unavailable' || states.current === 'failed') {
            showToast('⚠️ Real-time connection lost. Attempting to reconnect...');
        }
    });

    channel.bind('new-report', function(data) {
        console.log('Real-time report received:', data);
        
        // Show a non-intrusive notification
        showToast('📍 New report added nearby!');
        
        // Ensure relative URLs are converted to absolute URLs for frontend viewing
        if (data.photo_urls && Array.isArray(data.photo_urls)) {
            data.photo_urls = data.photo_urls.map(path => {
                if (path.startsWith('http') || path.startsWith('data:')) return path;
                return API_BASE_URL + '/../' + path;
            });
        }
        
        // Check if optimistic report already exists (e.g. we just submitted it)
        const existingIdx = currentReports.findIndex(r => r.id === data.id);
        if (existingIdx !== -1) {
            // Replace the optimistic report with the real one from Pusher
            currentReports[existingIdx] = data;
        } else {
            // Add to global array
            currentReports.unshift(data);
        }
        
        // Update Map if active
        if (typeof mainMap !== 'undefined' && mapInit) {
            addMapMarker(data);
            const activeBtn = document.querySelector('.filter-pill.active');
            if (activeBtn) filterMap(currentMapFilter, activeBtn);
        }
        
        // Update UI depending on current page
        if (currentPage === 'feed') {
            renderFeed(currentReports);
        } else if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
            renderAdminDashboard();
        }
        if (typeof updateHeroStats === 'function') updateHeroStats();
    });

    channel.bind('update-status', function(data) {
        console.log('Status update received:', data);
        
        // Show notification
        showToast('🔄 Report status updated!');
        
        // Update global array
        const report = currentReports.find(r => r.id === data.id);
        if (report) {
            report.status = data.status;
            
            // Update UI depending on current page
            if (currentPage === 'feed') {
                renderFeed(currentReports);
            } else if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                renderAdminDashboard();
            }
            if (typeof updateHeroStats === 'function') updateHeroStats();
            
            if (typeof mainMap !== 'undefined' && mapInit) {
                // Update marker popup content and icon
                const markerObj = allMarkers.find(m => m.report.id === report.id);
                if (markerObj) {
                    markerObj.marker.setIcon(makeIcon(report.cat, report.status));
                    markerObj.marker.setPopupContent(`<div style="font-family:Outfit,sans-serif;min-width:180px">
                        <div style="font-size:14px;font-weight:800;margin-bottom:4px">${(CAT_COLORS[report.cat]||CAT_COLORS.Other).emoji} ${report.id}</div>
                        <div style="font-size:12px;font-weight:700;color:${(CAT_COLORS[report.cat]||CAT_COLORS.Other).color}">${report.cat}</div>
                        <div style="font-size:12px;color:#6b7280;margin:4px 0">${report.loc}</div>
                        <div style="font-size:11px;color:#374151">${(report.desc||'').substring(0,80)}...</div>
                        <div style="margin-top:8px"><span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#dcfce7;color:#15803d">${report.status}</span></div>
                    </div>`);
                }
                const activeBtn = document.querySelector('.filter-pill.active');
                if (activeBtn) filterMap(currentMapFilter, activeBtn);
            }
        }
    });

    channel.bind('new-activity', function(data) {
        console.log('New activity received:', data);
        window.dispatchEvent(new CustomEvent('NEW_ACTIVITY', { detail: data }));
        if (currentPage === 'admin' && typeof renderLiveActivityFeed === 'function') {
            renderLiveActivityFeed();
        }
    });

    channel.bind('job-progress', function(data) {
        console.log('Job progress received:', data);
        window.dispatchEvent(new CustomEvent('JOB_PROGRESS', { detail: data }));
    });

    channel.bind('new-certificate', function(data) {
        console.log('New certificate received:', data);
        showToast('🏆 New certificate issued!');
        window.dispatchEvent(new CustomEvent('CERTIFICATE_ISSUED', { detail: data }));
    });

    channel.bind('certificate-email-sent', function(data) {
        console.log('Certificate email sent:', data);
        window.dispatchEvent(new CustomEvent('CERTIFICATE_EMAIL_SENT', { detail: data }));
    });

    channel.bind('update-priority', function(data) {
        console.log('Priority update received:', data);
        const report = currentReports.find(r => r.id === data.id);
        if (report) {
            report.priority = data.priority;
            if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                renderAdminDashboard();
            }
        }
    });

    // --- ALERT MANAGEMENT CHANNELS ---
    channel.bind('new-alert', function(data) {
        console.log('New alert received:', data);
        showToast(`⚠️ Urgent Alert: ${data.title}`);
        if (typeof fetchAlerts === 'function') fetchAlerts(true);
    });

    channel.bind('alert-updated', function(data) {
        console.log('Alert updated received:', data);
        if (typeof fetchAlerts === 'function') fetchAlerts(true);
    });

    channel.bind('session-updated', function(data) {
        console.log('Session updated received:', data);
        if (typeof openReviewSessionsModal === 'function' && document.getElementById('review-sessions-modal-overlay').classList.contains('open')) {
            openReviewSessionsModal();
        }
    });

    channel.bind('sync-progress', function(data) {
        console.log('Sync progress received:', data);
        const bar = document.getElementById('sync-progress-bar');
        const text = document.getElementById('sync-progress-text');
        const counts = document.getElementById('sync-progress-counts');
        const successVal = document.getElementById('sync-success-count');
        const failedVal = document.getElementById('sync-failed-count');
        const remainingVal = document.getElementById('sync-remaining-count');
        
        if (bar) bar.style.width = data.percent + '%';
        if (text) text.textContent = data.percent + '% Completed';
        if (counts) counts.textContent = `${data.success_count + data.failed_count} / ${data.total} Processed`;
        if (successVal) successVal.textContent = data.success_count;
        if (failedVal) failedVal.textContent = data.failed_count;
        if (remainingVal) remainingVal.textContent = data.remaining;
    });

    channel.bind('sync-completed', function(data) {
        console.log('Sync completed:', data);
        showToast(`✅ Sync completed: ${data.success_count} success, ${data.failed_count} failed.`);
        setTimeout(() => {
            document.getElementById('sync-progress-modal-overlay').classList.remove('open');
        }, 1500);
        if (typeof fetchAlerts === 'function') fetchAlerts(true);
    });

    channel.bind('ip-blocked', function(data) {
        console.log('IP Blocked event:', data);
        showToast(`🔒 IP block status changed: ${data.ip_address} is now ${data.status}`);
        if (typeof fetchBlockedIps === 'function') fetchBlockedIps();
        if (typeof fetchAlerts === 'function') fetchAlerts(true);
    });
}

function destroyRealtime() {
    if (pusher) {
        channel.unsubscribe('private-eco-channel');
        pusher.disconnect();
        pusher = null;
        channel = null;
        console.log("Realtime: Disconnected successfully.");
    }
}

// Auto-initialize if logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure sessionStorage and config are loaded
    setTimeout(() => {
        // Show browser notification if authorized
        if (!!sessionStorage.getItem('adminToken')) {
            initRealtime();
        }
    }, 100);
});
