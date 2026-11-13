( () => {
  const config = {
    url: "https://yhghivyejpavymjcbqnr.supabase.co",
    publishableKey: "sb_publishable_tsG8rK7NjTU6HsMTtVM2qw_-k0MIZAi",
  };

  const $ = (selector) => document.querySelector(selector);
  const dialog = $("#auth-dialog");
  const openButton = $("#auth-open-button");
  const loginButton = $("#auth-login-button");
  const signupButton = $("#auth-signup-button");
  const closeButton = $("#auth-close-button");
  const form = $("#auth-form");
  const emailInput = $("#auth-email");
  const passwordInput = $("#auth-password");
  const submitButton = $("#auth-submit-button");
  const modeButton = $("#auth-mode-button");
  const signoutButton = $("#auth-signout-button");
  const status = $("#auth-status");
  const intro = $("#auth-intro");
  const title = $("#auth-title");
  const emailLabel = $('label[for="auth-email"]');
  const passwordLabel = $('label[for="auth-password"]');
  const otpLabel = $("#auth-otp-label");
  const otpInput = $("#auth-otp");
  const resendButton = $("#auth-resend-button");
  const settings = $("#account-settings");
  const dialogFooter = $("#auth-dialog-footer");
  const privacyNote = $("#auth-privacy-note");
  let awaitingSignupCode = false;
  let currentUser = null;

  if (!dialog || !window.supabase?.createClient) {
    if (openButton) openButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let mode = "login";

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function closeAuthDialog() {
    if (dialog.open) dialog.close();
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
    form.hidden = false;
    settings.hidden = true;
    dialogFooter.hidden = false;
    privacyNote.hidden = false;
    showStatus("");
  }

  function activateSettingsTab(tabName) {
    document.querySelectorAll("[data-settings-tab]").forEach((button) => {
      const active = button.dataset.settingsTab === tabName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== tabName;
    });
  }

  function populateSettings(user) {
    const metadata = user.user_metadata || {};
    $("#profile-first-name").value = metadata.first_name || "";
    $("#profile-last-name").value = metadata.last_name || "";
    $("#profile-email").value = user.email || "";
    $("#privacy-email").textContent = user.email || "Non disponible";
    $("#privacy-created").textContent = user.created_at
      ? new Date(user.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })
      : "Non disponible";
    $("#privacy-verified").textContent = user.email_confirmed_at ? "Oui" : "En attente";
    $("#theme-toggle").checked = localStorage.getItem("quickposter-theme") === "light";
    $("#email-notifications-toggle").checked = localStorage.getItem("quickposter-email-notifications") === "true";
  }

  function updateAccount(user) {
    currentUser = user || null;
    openButton.hidden = !currentUser;
    if (loginButton) loginButton.hidden = Boolean(currentUser);
    if (signupButton) signupButton.hidden = Boolean(currentUser);
    openButton.textContent = "Mon compte";
    modeButton.hidden = Boolean(currentUser);
    form.hidden = Boolean(currentUser);
    settings.hidden = !currentUser;
    dialogFooter.hidden = Boolean(currentUser);
    privacyNote.hidden = Boolean(currentUser);
    intro.textContent = currentUser
      ? "Gérez les informations et les préférences de votre compte."
      : (mode === "signup" ? "Créez un compte avec votre adresse e-mail." : "Connectez-vous pour accéder à votre espace personnel.");
    if (currentUser) {
      title.textContent = "Paramètres de votre compte";
      populateSettings(currentUser);
      activateSettingsTab("profile");
    } else {
      setMode(mode);
    }
  }

  async function openAccountDialog(startMode = "login") {
    const trigger = startMode === "signup" ? signupButton : loginButton || openButton;
    if (trigger) trigger.disabled = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      updateAccount(data?.session?.user || null);
      if (dialog.showModal) dialog.showModal();
      if (currentUser) {
        activateSettingsTab("profile");
      } else {
        setMode(startMode);
        emailInput.focus();
      }
    } catch (error) {
      if (dialog.showModal) dialog.showModal();
      showStatus(error.message || "Impossible de vérifier votre connexion.", true);
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  openButton.addEventListener("click", () => openAccountDialog("login"));
  if (loginButton) loginButton.addEventListener("click", () => openAccountDialog("login"));
  if (signupButton) signupButton.addEventListener("click", () => openAccountDialog("signup"));

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  modeButton.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => activateSettingsTab(button.dataset.settingsTab));
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
        const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "signup" });
        if (error) throw error;
        awaitingSignupCode = false;
        updateAccount(data.user);
        emailInput.value = "";
        passwordInput.value = "";
        otpInput.value = "";
        showStatus("Adresse e-mail vérifiée. Vous êtes connecté à QUICKPOSTER.");
        closeAuthDialog();
      } else {
        showStatus(mode === "signup" ? "Création du compte en cours…" : "Connexion en cours…");
        const result = mode === "signup"
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
        if (result.error) {
          if (mode === "signup" && /already registered|already exists/i.test(result.error.message || "")) {
            setMode("login");
            showStatus("Cette adresse semble déjà associée à un compte. Connectez-vous avec votre mot de passe.", true);
            return;
          }
          throw result.error;
        }
        if (mode === "signup" && result.data.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
          setMode("login");
          showStatus("Cette adresse possède déjà un compte. Vous avez été redirigé vers Connexion. Saisissez votre mot de passe.", true);
          return;
        }
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
          showStatus("La demande d’inscription a été acceptée. Si l’e-mail de vérification est distribué, vous recevrez un code à " + email + ". Vérifiez aussi les courriers indésirables.");
        } else {
          updateAccount(result.data.user);
          // Effacer les identifiants du formulaire après une connexion réussie.
          emailInput.value = "";
          passwordInput.value = "";
          otpInput.value = "";
          showStatus(mode === "signup" ? "Compte créé et connecté." : "Connexion réussie.");
          closeAuthDialog();
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
    showStatus(error ? (error.message || "Impossible de demander un nouvel envoi.") : "Demande de renvoi acceptée. La réception du message n’est pas encore confirmée.");
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) return;
    const firstName = $("#profile-first-name").value.trim();
    const lastName = $("#profile-last-name").value.trim();
    const { data, error } = await client.auth.updateUser({
      data: { ...(currentUser.user_metadata || {}), first_name: firstName, last_name: lastName, full_name: [firstName, lastName].filter(Boolean).join(" ") }
    });
    if (error) return showStatus(error.message || "Impossible d’enregistrer le profil.", true);
    updateAccount(data.user);
    activateSettingsTab("profile");
    showStatus("Profil enregistré.");
  });

  $("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const nextPassword = $("#new-password").value;
    const confirmation = $("#confirm-password").value;
    if (nextPassword.length < 8) return showStatus("Le mot de passe doit contenir au moins 8 caractères.", true);
    if (nextPassword !== confirmation) return showStatus("Les deux mots de passe ne correspondent pas.", true);
    const { error } = await client.auth.updateUser({ password: nextPassword });
    if (error) return showStatus(error.message || "Impossible de modifier le mot de passe.", true);
    $("#password-form").reset();
    showStatus("Mot de passe mis à jour.");
  });

  $("#theme-toggle").addEventListener("change", (event) => {
    const theme = event.target.checked ? "light" : "dark";
    localStorage.setItem("quickposter-theme", theme);
    document.body.dataset.theme = theme;
    showStatus("Préférence d’apparence enregistrée sur cet appareil.");
  });

  $("#email-notifications-toggle").addEventListener("change", (event) => {
    localStorage.setItem("quickposter-email-notifications", String(event.target.checked));
    showStatus("Préférence enregistrée sur cet appareil. Les e-mails automatiques ne sont pas encore activés.");
  });

  document.body.dataset.theme = localStorage.getItem("quickposter-theme") || "dark";

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
    closeAuthDialog();
  });

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) {
      showStatus("Impossible de vérifier la session.", true);
      return;
    }
    if (data?.session?.user) updateAccount(data.session.user);
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) showStatus("Impossible de vérifier la session.", true);
    updateAccount(data?.session?.user || null);
  });

  client.auth.onAuthStateChange((event, session) => {
    updateAccount(session?.user || null);
    if (event === "SIGNED_IN" && session?.user) showStatus("Vous êtes connecté à QUICKPOSTER.");
  });

  window.addEventListener("focus", refreshSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshSession();
  });
})();