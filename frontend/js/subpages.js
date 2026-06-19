// Accordion Logic
function togglePrivacyAccordion(element) {
  const item = element.parentElement;
  const isActive = item.classList.contains('active');
  
  // Close all other accordions
  document.querySelectorAll('.accordion-item.active').forEach(acc => {
    acc.classList.remove('active');
  });

  // If the clicked one wasn't active, open it
  if (!isActive) {
    item.classList.add('active');
  }
}

// PDF Download Simulation
function simulatePdfDownload() {
  const btn = document.getElementById('btn-download-pdf');
  const container = document.getElementById('download-progress-container');
  const bar = document.getElementById('download-progress-bar');
  const text = document.getElementById('download-progress-text');

  if (!btn || !container || !bar || !text) return;

  btn.style.display = 'none';
  container.style.display = 'block';
  
  let progress = 0;
  bar.style.width = '0%';
  text.textContent = '0%';

  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      bar.style.width = '100%';
      text.textContent = '100% - Download Complete';
      
      // Reset after a delay
      setTimeout(() => {
        container.style.display = 'none';
        btn.style.display = 'inline-block';
        btn.innerHTML = '✅ Downloaded';
        setTimeout(() => {
          btn.innerHTML = '📥 Download Q2 Report PDF';
        }, 3000);
      }, 1500);
      
      // Show toast
      if (typeof showToast === 'function') {
        showToast('PDF Report downloaded successfully.');
      }
    } else {
      bar.style.width = progress + '%';
      text.textContent = progress + '%';
    }
  }, 300);
}

// Contact Form Logic
function handleContactSubmit(event) {
  event.preventDefault();
  
  const subject = document.getElementById('contact-subject');
  const name = document.getElementById('contact-name');
  const email = document.getElementById('contact-email');
  const role = document.getElementById('contact-role');
  const msg = document.getElementById('contact-msg');
  
  let isValid = true;

  document.querySelectorAll('.error-feedback').forEach(el => el.textContent = '');

  if (subject && !subject.value.trim()) {
    const err = document.getElementById('contact-subject-error');
    if (err) err.textContent = 'Subject is required.';
    isValid = false;
  }
  if (name && !name.value.trim()) {
    const err = document.getElementById('contact-name-error');
    if (err) err.textContent = 'Name is required.';
    isValid = false;
  }
  if (email && (!email.value.trim() || !email.value.includes('@'))) {
    const err = document.getElementById('contact-email-error');
    if (err) err.textContent = 'Valid email is required.';
    isValid = false;
  }
  if (role && !role.value) {
    const err = document.getElementById('contact-role-error');
    if (err) err.textContent = 'Please select a role.';
    isValid = false;
  }
  if (msg && !msg.value.trim()) {
    const err = document.getElementById('contact-msg-error');
    if (err) err.textContent = 'Message is required.';
    isValid = false;
  }

  if (isValid) {
    const btn = document.getElementById('btn-contact-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Sending...';
    btn.disabled = true;

    setTimeout(() => {
      document.getElementById('contact-form-wrap').style.display = 'none';
      
      if (document.getElementById('thankyou-name') && name) {
        document.getElementById('thankyou-name').textContent = name.value.trim();
      }
      if (document.getElementById('thankyou-email') && email) {
        document.getElementById('thankyou-email').textContent = email.value.trim();
      }
      
      const thankYouPanel = document.getElementById('contact-thankyou');
      if (thankYouPanel) thankYouPanel.style.display = 'block';
      
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 1000);
  }
}

function resetContactForm() {
  const form = document.getElementById('contact-form');
  if (form) form.reset();
  
  const thankYouPanel = document.getElementById('contact-thankyou');
  if (thankYouPanel) thankYouPanel.style.display = 'none';
  
  const formWrap = document.getElementById('contact-form-wrap');
  if (formWrap) formWrap.style.display = 'block';
}

