(() => {
  const config = {
    url: "https://yhghivyejpavymjcbqnr.supabase.co",
    publishableKey: "sb_publishable_tsG8rK7NjTU6HsMTtVM2qw_-k0MIZAi",
  };

  const dialog = document.querySelector("#auth-dialog");
  const openButton = document.querySelector("#auth-open-button");
  const closeButton = document.querySelector("#auth-close-button");
  const form = document.querySelector("#auth-form");
  const emailInput = document.querySelector("#auth-email");
  const passwordInput = document.querySelector("#auth-password");
  const submitButton = document.querySelector("#auth-submit-button");
  const modeButton = document.querySelector("#auth-mode-button");
  const signoutButton = document.querySelector("#auth-signout-button");
  const status = document.querySelector("#auth-status");
  const intro = document.querySelector("#auth-intro");
  const title = document.querySelector("#auth-title");
  const emailLabel = document.querySelector('label[for="auth-email"]');
  const passwordLabel = document.querySelector('label[for="auth-password"]');
  const otpLabel = document.querySelector("#auth-otp-label");
  const otpInput = document.querySelector("#auth-otp");
  const resendButton = document.querySelector("#auth-resend-button");
  let awaitingSignupCode = false;

  if (!dialog || !window.supabase?.createClient) {
    if (openButton) openButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let mode = "login";
  let currentUser = null;

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function setMode(nextMode) {
    mode = nextMode;
    const creating = mode === "signup";
    title.textContent = creating ? "Créer votre compte" : "Bienvenue sur QUICKPOSTER";
    intro.textContent = creating
      ? "Créez un compte avec votre adresse e-mail."
      : "Connectez-vous pour accéder à votre espace personnel.";
    submitButton.textContent = creating ? "Créer mon compte" : "Se connecter";
    modeButton.textContent = creating ? "J’ai déjà un compte" : "Créer un compte";
    passwordInput.autocomplete = creating ? "new-password" : "current-password";
    awaitingSignupCode = false;
    emailInput.disabled = false;
    passwordInput.disabled = false;
    emailLabel.hidden = false;
    emailInput.hidden = false;
    passwordLabel.hidden = false;
    passwordInput.hidden = false;
    otpLabel.hidden = true;
    otpInput.hidden = true;
    resendButton.hidden = true;
    otpInput.value = "";
    showStatus("");
  }

  function updateAccount(user) {
    currentUser = user || null;
    openButton.textContent = currentUser ? "Mon compte · connecté" : "Mon compte";
    modeButton.hidden = Boolean(currentUser);
    signoutButton.hidden = !currentUser;
    form.hidden = Boolean(currentUser);
    intro.textContent = currentUser
      ? "Vous êtes connecté à QUICKPOSTER avec votre adresse e-mail."
      : (mode === "signup" ? "Créez un compte avec votre adresse e-mail." : "Connectez-vous pour accéder à votre espace personnel.");
    if (currentUser) {
      title.textContent = "Votre compte QUICKPOSTER";
      showStatus(currentUser.email || "Compte connecté.");
    } else {
      setMode(mode);
    }
  }

  openButton.addEventListener("click", () => {
    if (dialog.showModal) dialog.showModal();
    if (currentUser) updateAccount(currentUser);
    else emailInput.focus();
  });

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  modeButton.addEventListener("click", () => {
    setMode(mode === "login" ? "signup" : "login");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || password.length < 8) {
      showStatus("Saisissez une adresse e-mail valide et un mot de passe d’au moins 8 caractères.", true);
      return;
    }

    submitButton.disabled = true;
    try {
      if (awaitingSignupCode) {
        const code = otpInput.value.trim();
        if (!/^\d{6}$/.test(code)) throw new Error("Saisissez le code à 6 chiffres reçu par e-mail.");
        showStatus("Vérification du code…");
        const { data, error } = await client.auth.verifyOtp({ email: emailInput.value.trim(), token: code, type: "signup" });
        if (error) throw error;
        awaitingSignupCode = false;
        updateAccount(data.user);
        showStatus("Adresse e-mail vérifiée. Vous êtes connecté à QUICKPOSTER.");
      } else {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || password.length < 8) throw new Error("Saisissez une adresse e-mail valide et un mot de passe d’au moins 8 caractères.");
        showStatus(mode === "signup" ? "Création du compte en cours…" : "Connexion en cours…");
        const result = mode === "signup"
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (mode === "signup" && !result.data.session) {
          awaitingSignupCode = true;
          emailLabel.hidden = true;
          emailInput.hidden = true;
          passwordLabel.hidden = true;
          passwordInput.hidden = true;
          otpLabel.hidden = false;
          otpInput.hidden = false;
          resendButton.hidden = false;
          otpInput.focus();
          submitButton.textContent = "Vérifier mon adresse e-mail";
          modeButton.hidden = true;
          showStatus("Un code de vérification vient d’être envoyé à " + email + ". Saisissez-le ici pour activer votre compte.");
        } else {
          updateAccount(result.data.user);
          showStatus(mode === "signup" ? "Compte créé et connecté." : "Connexion réussie.");
        }
      }
    } catch (error) {
      showStatus(error.message || "Une erreur est survenue. Réessayez.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  resendButton.addEventListener("click", async () => {
    resendButton.disabled = true;
    const { error } = await client.auth.resend({ type: "signup", email: emailInput.value.trim() });
    resendButton.disabled = false;
    showStatus(error ? (error.message || "Impossible de renvoyer le code.") : "Un nouveau code vient d’être envoyé.");
  });

  signoutButton.addEventListener("click", async () => {
    signoutButton.disabled = true;
    const { error } = await client.auth.signOut();
    signoutButton.disabled = false;
    if (error) {
      showStatus(error.message || "La déconnexion a échoué.", true);
      return;
    }
    emailInput.value = "";
    passwordInput.value = "";
    setMode("login");
    updateAccount(null);
    showStatus("Vous êtes déconnecté.");
  });

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) {
      showStatus("Impossible de vérifier la session.", true);
      return;
    }
    if (data?.session?.user) {
      updateAccount(data.session.user);
      showStatus("Compte connecté. Vous pouvez continuer sur cet onglet.");
    }
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) showStatus("Impossible de vérifier la session.", true);
    updateAccount(data?.session?.user || null);
  });

  client.auth.onAuthStateChange((event, session) => {
    updateAccount(session?.user || null);
    if (event === "SIGNED_IN" && session?.user) {
      showStatus("Vous êtes connecté à QUICKPOSTER.");
    }
  });

  // If email confirmation opens another tab, refresh this original tab
  // as soon as the user returns to it.
  window.addEventListener("focus", refreshSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshSession();
  });
})();