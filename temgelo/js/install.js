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
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        return !!(choice && choice.outcome === "accepted");
      }
      if (isIos()) {
        alert(
          "Para instalar no iPhone/iPad:\n\n" +
            "1. Toque em Partilhar (□↑)\n" +
            "2. Escolha «Adicionar ao Ecrã Principal»\n" +
            "3. Confirme"
        );
        return false;
      }
      alert(
        "Para instalar a app:\n\n" +
          "No Chrome/Edge: menu ⋮ → «Instalar aplicação» ou «Adicionar ao ecrã principal».\n\n" +
          "Se o botão não aparecer, abra o site no navegador (não em modo anónimo)."
      );
      return false;
    }
  };
})();
