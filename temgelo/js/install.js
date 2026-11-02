// Tem Gelo? – PWA install helper
(function () {
  let deferredPrompt = null;
  const listeners = new Set();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => {
      try {
        fn(true);
      } catch (_) {}
    });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => {
      try {
        fn(false);
      } catch (_) {}
    });
  });

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isSafari() {
    const ua = navigator.userAgent;
    return /safari/i.test(ua) && !/crios|fxios|edgios|opios|chrome|android/i.test(ua);
  }

  function ensureInstallSheet() {
    let el = document.getElementById("temgelo-install-sheet");
    if (el) return el;

    el = document.createElement("div");
    el.id = "temgelo-install-sheet";
    el.className = "install-sheet hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "temgelo-install-title");
    el.innerHTML =
      '<div class="install-sheet-backdrop" data-close="1"></div>' +
      '<div class="install-sheet-card">' +
      '  <div class="install-sheet-head">' +
      '    <h3 id="temgelo-install-title">Instalar Tem Gelo?</h3>' +
      '    <button type="button" class="install-sheet-close" data-close="1" aria-label="Fechar">×</button>' +
      "  </div>" +
      '  <div class="install-sheet-body" id="temgelo-install-body"></div>' +
      '  <div class="install-sheet-actions">' +
      '    <button type="button" class="btn btn-ghost" data-close="1">Fechar</button>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", (e) => {
      if (e.target && e.target.getAttribute("data-close") === "1") {
        hideInstallSheet();
      }
    });
    return el;
  }

  function hideInstallSheet() {
    const el = document.getElementById("temgelo-install-sheet");
    if (el) el.classList.add("hidden");
  }

  function showIosInstallSheet() {
    const el = ensureInstallSheet();
    const body = document.getElementById("temgelo-install-body");
    const inSafari = isSafari();
    body.innerHTML =
      '<p class="install-sheet-lead">' +
      (inSafari
        ? "No iPhone/iPad a instalação é feita pelo Safari (a Apple não permite o botão automático «Instalar»)."
        : "Abra este site no <strong>Safari</strong> para adicionar ao ecrã principal. Noutros browsers do iPhone o atalho pode não funcionar.") +
      "</p>" +
      '<ol class="install-steps">' +
      "  <li><span class=\"step-num\">1</span><span>Toque em <strong>Partilhar</strong> " +
      '<svg class="share-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 5l-1.4 1.4 1.6 1.6H9v2h7.2l-1.6 1.6L16 13l4-4-4-4zM4 19h12v-6h2v6c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h6v2H4v12z"/></svg>' +
      " na barra inferior (ou superior).</span></li>" +
      "  <li><span class=\"step-num\">2</span><span>Desça e escolha <strong>«Adicionar ao Ecrã Principal»</strong>.</span></li>" +
      "  <li><span class=\"step-num\">3</span><span>Toque em <strong>Adicionar</strong>. O ícone Tem Gelo? fica no ecrã inicial.</span></li>" +
      "</ol>" +
      '<p class="install-sheet-note">É o único método que a Apple permite para apps web. Depois de instalada, abre em ecrã completo como uma app.</p>';
    el.classList.remove("hidden");
  }

  function showGenericInstallSheet() {
    const el = ensureInstallSheet();
    const body = document.getElementById("temgelo-install-body");
    body.innerHTML =
      '<p class="install-sheet-lead">Para instalar Tem Gelo? neste dispositivo:</p>' +
      '<ul class="install-steps-plain">' +
      "  <li><strong>Chrome / Edge:</strong> menu ⋮ → «Instalar aplicação» ou «Adicionar ao ecrã principal».</li>" +
      "  <li><strong>Firefox:</strong> menu → «Instalar» (se disponível).</li>" +
      "  <li>Evite modo anónimo / privado — o navegador pode bloquear a instalação.</li>" +
      "</ul>";
    el.classList.remove("hidden");
  }

  window.temGeloInstall = {
    canPrompt() {
      return !!deferredPrompt;
    },
    isStandalone,
    isIos,
    onAvailability(fn) {
      if (typeof fn === "function") {
        listeners.add(fn);
        fn(!!deferredPrompt && !isStandalone());
      }
      return () => listeners.delete(fn);
    },
    async promptInstall() {
      if (isStandalone()) {
        alert("A app já está instalada neste dispositivo.");
        return false;
      }
      // Android / desktop Chromium: native install prompt when available
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        return !!(choice && choice.outcome === "accepted");
      }
      // iOS: no beforeinstallprompt — guided sheet only (Apple restriction)
      if (isIos()) {
        showIosInstallSheet();
        return false;
      }
      showGenericInstallSheet();
      return false;
    }
  };
})();
