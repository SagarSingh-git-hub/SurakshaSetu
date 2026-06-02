// ── SUB-PAGES INTERACTIVE LOGIC ──

// 1. PDF Download Simulator
function simulatePdfDownload() {
    const btn = document.getElementById('btn-download-pdf');
    const progressContainer = document.getElementById('download-progress-container');
    const progressBar = document.getElementById('download-progress-bar');
    const progressText = document.getElementById('download-progress-text');

    if (!btn || !progressContainer || !progressBar || !progressText) return;

    // Set disabled state
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.6';
    btn.innerHTML = '📥 Simulating Server Request...';

    // Show progress elements
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    let percent = 0;
    const interval = setInterval(() => {
        percent += 5;
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';

        if (percent === 30) {
            btn.innerHTML = '⚡ Generating Spatials Audit...';
        } else if (percent === 60) {
            btn.innerHTML = '📊 Compiling NGO Logs...';
        } else if (percent === 85) {
            btn.innerHTML = '🔒 Sign-sealing PDF Certificate...';
        }

        if (percent >= 100) {
            clearInterval(interval);

            // Complete state
            btn.innerHTML = '✅ Q2 Report Downloaded';
            btn.style.background = 'var(--g700)';
            btn.style.color = '#fff';

            // Simulate file download trigger
            const dummyFile = new Blob(["Suraksha Setu Q2 2026 Impact Report\n\nVerified Tons of Trash Diverted: 142 Tons\nTrees Planted: 480\nPlastic Recycled: 88,400+ Units\nDirty Areas Sanitized: 89\nNGO Partners: 12\nVolunteers Active: 1,200+\n\nCompiled on June 1, 2026.\nThis is a simulation of the dynamic PDF generator."], { type: 'text/plain' });
            const dummyUrl = URL.createObjectURL(dummyFile);
            const dummyLink = document.createElement('a');
            dummyLink.href = dummyUrl;
            dummyLink.download = 'SurakshaSetu_Q2_2026_Impact_Report.txt';
            document.body.appendChild(dummyLink);
            dummyLink.click();
            document.body.removeChild(dummyLink);

            showToast('🎉 Impact Report PDF downloaded successfully!');

            // Reset after delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
                btn.disabled = false;
                btn.style.pointerEvents = 'all';
                btn.style.opacity = '1';
                btn.style.background = 'linear-gradient(135deg,var(--g600),var(--g800))';
                btn.innerHTML = '📥 Download Q2 Report PDF';
            }, 3500);
        }
    }, 100);
}

// 2. Accordion Toggles for Privacy Policy
function togglePrivacyAccordion(element) {
    const item = element.closest('.accordion-item');
    if (!item) return;

    const isActive = item.classList.contains('active');

    // Close all other accordions for premium feeling
    document.querySelectorAll('.accordion-item').forEach(acc => {
        acc.classList.remove('active');
        const content = acc.querySelector('.accordion-content');
        if (content) content.style.maxHeight = null;
    });

    // Toggle current
    if (!isActive) {
        item.classList.add('active');
        const content = item.querySelector('.accordion-content');
        if (content) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    }
}

// 3. Contact Form Submission handling
function validateContactForm() {
    const subject = document.getElementById('contact-subject').value.trim();
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const role = document.getElementById('contact-role').value;
    const msg = document.getElementById('contact-msg').value.trim();

    let hasError = false;

    // Simple validation helpers
    const clearError = (id) => {
        const el = document.getElementById(id);
        el.classList.remove('invalid');
        const err = document.getElementById(id + '-error');
        if (err) err.style.display = 'none';
    };

    const showError = (id, text) => {
        const el = document.getElementById(id);
        el.classList.add('invalid');
        const err = document.getElementById(id + '-error');
        if (err) {
            err.textContent = text;
            err.style.display = 'block';
        }
        hasError = true;
    };

    // Clear existing errors
    clearError('contact-subject');
    clearError('contact-name');
    clearError('contact-email');
    clearError('contact-role');
    clearError('contact-msg');

    if (!subject) showError('contact-subject', 'Please specify a subject');
    if (!name) showError('contact-name', 'Name is required');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        showError('contact-email', 'Email address is required');
    } else if (!emailRegex.test(email)) {
        showError('contact-email', 'Please enter a valid email address');
    }

    if (!role) showError('contact-role', 'Please choose your relation role');
    if (!msg) {
        showError('contact-msg', 'Message text cannot be blank');
    } else if (msg.length < 10) {
        showError('contact-msg', 'Please write a descriptive message (at least 10 characters)');
    }

    return !hasError;
}

function handleContactSubmit(event) {
    if (event) event.preventDefault();

    if (!validateContactForm()) {
        showToast('⚠️ Please fix the highlighted form errors.');
        return;
    }

    const form = document.getElementById('contact-form');
    const formWrap = document.getElementById('contact-form-wrap');
    const thankYou = document.getElementById('contact-thankyou');
    const submitBtn = document.getElementById('btn-contact-submit');

    const nameVal = document.getElementById('contact-name').value.trim();
    const emailVal = document.getElementById('contact-email').value.trim();

    // Disable form elements
    const inputs = form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(i => i.disabled = true);

    // Spinner inside button
    submitBtn.innerHTML = '<span class="spin" style="display:inline-block;margin-right:8px">♻️</span> Sending Securely...';
    submitBtn.style.opacity = '0.8';

    setTimeout(() => {
        // Hide form wrap and show success state
        formWrap.style.display = 'none';
        thankYou.style.display = 'block';
        thankYou.classList.add('fade-in-up');

        // Inject custom summary in success panel
        document.getElementById('thankyou-name').textContent = nameVal;
        document.getElementById('thankyou-email').textContent = emailVal;

        showToast('✉️ Message sent! We\'ll reply within 12 hours.');
    }, 1500);
}

function resetContactForm() {
    const form = document.getElementById('contact-form');
    const formWrap = document.getElementById('contact-form-wrap');
    const thankYou = document.getElementById('contact-thankyou');
    const submitBtn = document.getElementById('btn-contact-submit');

    if (!form || !formWrap || !thankYou || !submitBtn) return;

    // Reset values
    form.reset();

    // Re-enable elements
    const inputs = form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(i => {
        i.disabled = false;
        i.classList.remove('invalid');
    });

    // Reset errors
    document.querySelectorAll('.error-feedback').forEach(el => el.style.display = 'none');

    // Reset submit button state
    submitBtn.innerHTML = 'Send Secure Message →';
    submitBtn.style.opacity = '1';

    // Toggle views
    thankYou.style.display = 'none';
    formWrap.style.display = 'block';
}
