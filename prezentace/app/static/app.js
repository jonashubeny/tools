// Rename / set-password forms ask for the value, delete forms ask for confirmation.
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.confirm && !confirm(form.dataset.confirm)) {
    e.preventDefault();
  } else if (form.dataset.prompt) {
    const value = prompt(form.dataset.prompt, form.dataset.value || '');
    if (!value || !value.trim()) {
      e.preventDefault();
      return;
    }
    form.elements[form.dataset.field || 'name'].value = value;
  }
});

// Upload with a progress bar.
const uploadForm = document.getElementById('upload-form');
if (uploadForm) {
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const progress = document.getElementById('upload-progress');
    const button = uploadForm.querySelector('button');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadForm.action);
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) progress.value = (ev.loaded / ev.total) * 100;
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 400) {
        alert(xhr.status === 413 ? xhr.responseText : 'Nahrání se nezdařilo.');
        progress.hidden = true;
        button.disabled = false;
      } else {
        location.reload();
      }
    });
    xhr.addEventListener('error', () => {
      alert('Nahrání se nezdařilo.');
      progress.hidden = true;
      button.disabled = false;
    });
    progress.hidden = false;
    button.disabled = true;
    xhr.send(new FormData(uploadForm));
  });
}

// Reload once a presentation that was being converted is finished.
const pending = [...document.querySelectorAll('[data-processing]')];
if (pending.length) {
  const timer = setInterval(async () => {
    try {
      const statuses = await (await fetch('/status')).json();
      const stillProcessing = Object.values(statuses).filter((s) => s === 'processing').length;
      if (stillProcessing < pending.length && !(uploadForm && uploadForm.querySelector('button').disabled)) {
        clearInterval(timer);
        location.reload();
      }
    } catch (_) { /* server restarting, try again */ }
  }, 3000);
}
