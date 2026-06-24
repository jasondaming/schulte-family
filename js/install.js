let deferredInstallPrompt = null;
let installInitialized = false;

export function initInstallPrompt() {
  if (installInitialized) return;
  installInitialized = true;

  const cardAction = document.getElementById('install-card-action');
  const cardBtn = document.getElementById('install-app-btn');
  const navBtn = document.getElementById('install-nav-btn');
  const buttons = [cardBtn, navBtn].filter(Boolean);

  if (!buttons.length || isStandalone()) return;

  const showButtons = () => {
    if (cardAction) cardAction.hidden = false;
    if (navBtn) navBtn.hidden = false;
  };
  const hideButtons = () => {
    if (cardAction) cardAction.hidden = true;
    if (navBtn) navBtn.hidden = true;
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideButtons();
  });

  buttons.forEach(button => {
    button.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') hideButtons();
        return;
      }

      showInstallHelp();
    });
  });

  if (isAppleMobile() || isAndroidMobile()) showButtons();
}

function showInstallHelp() {
  const existing = document.getElementById('install-help-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'install-help-modal';
  modal.className = 'install-modal-backdrop';
  modal.innerHTML = `
    <div class="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
      <button type="button" class="install-modal-close" aria-label="Close">&times;</button>
      <h2 id="install-help-title">Add to Home Screen</h2>
      ${installInstructionsHtml()}
    </div>`;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.install-modal-close').addEventListener('click', close);
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });
}

function installInstructionsHtml() {
  if (isAppleMobile()) {
    return `
      <ol class="install-steps">
        <li>Tap the browser Share button.</li>
        <li>Choose Add to Home Screen.</li>
        <li>Tap Add.</li>
      </ol>`;
  }

  return `
    <ol class="install-steps">
      <li>Open the browser menu.</li>
      <li>Choose Add to Home screen or Install app.</li>
      <li>Confirm Add or Install.</li>
    </ol>`;
}

function isStandalone() {
  const standaloneMedia = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standaloneMedia || window.navigator.standalone === true;
}

function isAppleMobile() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroidMobile() {
  return /Android/i.test(navigator.userAgent || '');
}