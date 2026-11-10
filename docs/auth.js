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
    showStatus(mode === "signup" ? "Création du compte en cours…" : "Connexion en cours…");
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: "https://ibrahim10io.github.io/QuickPoster/" } })
        : await client.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        showStatus("Compte créé ! Ouvrez l’e-mail de confirmation. Après validation, QUICKPOSTER vous reconnectera automatiquement.");
      } else {
        updateAccount(result.data.user);
        showStatus(mode === "signup" ? "Compte créé et connecté." : "Connexion réussie.");
      }
    } catch (error) {
      showStatus(error.message || "Une erreur est survenue. Réessayez.", true);
    } finally {
      submitButton.disabled = false;
    }
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
})();