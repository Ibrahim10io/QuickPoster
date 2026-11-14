const routes = {
  accueil: "Accueil",
  "nouvelle-affiche": "Nouvelle affiche",
  "mes-creations": "Mes créations",
  historique: "Historique des créations",
};


const storageKey = "quickposter.creations.v1";
const cloudConfig = {
  url: "https://yhghivyejpavymjcbqnr.supabase.co",
  publishableKey: "sb_publishable_tsG8rK7NjTU6HsMTtVM2qw_-k0MIZAi",
};
const cloudClient = window.supabase?.createClient
  ? window.supabase.createClient(cloudConfig.url, cloudConfig.publishableKey)
  : null;
let cloudUser = null;
let cloudSyncVersion = 0;

function toCloudCreation(creation, userId) {
  return {
    id: creation.id,
    user_id: userId,
    title: creation.title,
    poster_data: {
      subtitle: creation.subtitle,
      texts: creation.texts,
      template: creation.template,
      colors: creation.colors,
    },
    created_at: creation.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function fromCloudCreation(row) {
  const data = row.poster_data || {};
  return {
    id: row.id,
    title: row.title,
    subtitle: data.subtitle || "",
    texts: data.texts || {},
    template: data.template || "atelier",
    colors: data.colors || { background: "#ffffff", accent: "#222222" },
    createdAt: row.created_at,
  };
}

async function loadCloudCreations(user) {
  if (!cloudClient || !user) return;
  const version = ++cloudSyncVersion;
  const { data, error } = await cloudClient
    .from("creations")
    .select("id,title,poster_data,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (version !== cloudSyncVersion || cloudUser?.id !== user.id) return;
  const creations = (data || []).map(fromCloudCreation);
  window.localStorage.setItem(storageKey, JSON.stringify(creations));
  renderSavedCreations();
}

async function saveCloudCreation(creation) {
  if (!cloudClient || !cloudUser) return false;
  const { error } = await cloudClient
    .from("creations")
    .upsert(toCloudCreation(creation, cloudUser.id), { onConflict: "id" });
  if (error) throw error;
  return true;
}

async function deleteCloudCreation(creationId) {
  if (!cloudClient || !cloudUser) return false;
  const { error } = await cloudClient
    .from("creations")
    .delete()
    .eq("id", creationId)
    .eq("user_id", cloudUser.id);
  if (error) throw error;
  return true;
}

if (cloudClient) {
  cloudClient.auth.onAuthStateChange((event, session) => {
    const nextUser = session?.user || null;
    if (nextUser?.id !== cloudUser?.id) {
      cloudUser = nextUser;
      if (cloudUser) {
        loadCloudCreations(cloudUser).catch((error) => {
          console.error("Synchronisation QUICKPOSTER impossible", error);
        });
      } else {
        cloudSyncVersion += 1;
        window.localStorage.removeItem(storageKey);
        renderSavedCreations();
      }
    }
  });
}
const views = [...document.querySelectorAll("[data-view]")];
const navigationLinks = [...document.querySelectorAll("[data-route]")];
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const mainNav = document.querySelector("#main-nav");
const pageLabel = document.querySelector("#page-label");
const creationList = document.querySelector("#creation-list");
const historyList = document.querySelector("#history-list");
const creationsEmpty = document.querySelector("#creations-empty");
const historyEmpty = document.querySelector("#history-empty");

function setMobileMenuOpen(isOpen) {
  const sidebar = mobileMenuToggle?.closest(".sidebar");
  if (!sidebar || !mobileMenuToggle) return;

  sidebar.classList.toggle("menu-open", isOpen);
  mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
  mobileMenuToggle.setAttribute("aria-label", isOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation");
}

if (mobileMenuToggle && mainNav) {
  mobileMenuToggle.addEventListener("click", () => {
    setMobileMenuOpen(mobileMenuToggle.getAttribute("aria-expanded") !== "true");
  });

  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("[data-route]")) {
      setMobileMenuOpen(false);
      if (event.detail === 0) mobileMenuToggle.focus();
    }
  });

  document.addEventListener("click", async (event) => {
    if (!mobileMenuToggle.closest(".sidebar").contains(event.target)) {
      setMobileMenuOpen(false);
      if (mainNav.contains(document.activeElement)) mobileMenuToggle.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenuToggle.getAttribute("aria-expanded") === "true") {
      setMobileMenuOpen(false);
      mobileMenuToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 761px)").matches) setMobileMenuOpen(false);
  });
}

const templateNames = {
  atelier: "Atelier",
  impact: "Impact",
  editorial: "Éditorial",
};
const posterTextFields = ["businessName", "businessType", "description", "product", "promotion", "price", "contact"];

function readCreations() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored) ? stored.filter((creation) => (
      creation &&
      typeof creation.id === "string" &&
      typeof creation.title === "string" &&
      typeof creation.createdAt === "string" &&
      creation.texts &&
      creation.colors
    )) : [];
  } catch {
    return [];
  }
}

function formatCreationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createCreationPreview(creation) {
  const preview = document.createElement("div");
  preview.className = `creation-preview template-${creation.template}`;
  preview.setAttribute("aria-label", `Aperçu : ${creation.title}`);
  preview.style.setProperty("--creation-bg", creation.colors.background);
  preview.style.setProperty("--creation-accent", creation.colors.accent);
  preview.append(
    createTextElement("span", "creation-preview-type", creation.subtitle),
    createTextElement("strong", "creation-preview-title", creation.title),
    createTextElement("span", "creation-preview-product", creation.texts.product || "Affiche"),
  );
  return preview;
}

function createCreationCard(creation) {
  const card = document.createElement("article");
  card.className = "creation-card";
  card.append(createCreationPreview(creation));

  const content = document.createElement("div");
  content.className = "creation-card-content";
  content.append(
    createTextElement("h2", "creation-card-title", creation.title),
    createTextElement("p", "creation-card-subtitle", creation.subtitle),
    createTextElement("p", "creation-card-meta", `${templateNames[creation.template] || "Modèle"} · ${formatCreationDate(creation.createdAt)}`),
  );

  const actions = document.createElement("div");
  actions.className = "creation-card-actions";

  const openButton = createTextElement("button", "secondary-button", "Ouvrir");
  openButton.type = "button";
  openButton.dataset.openCreation = creation.id;
  actions.append(openButton);

  const downloadButton = createTextElement("button", "secondary-button download-button", "Télécharger en PNG");
  downloadButton.type = "button";
  downloadButton.dataset.downloadCreation = creation.id;
  downloadButton.setAttribute("aria-label", `Télécharger ${creation.title} en PNG`);
  actions.append(downloadButton);

  const downloadPdfButton = createTextElement("button", "secondary-button download-button", "Télécharger en PDF");
  downloadPdfButton.type = "button";
  downloadPdfButton.dataset.downloadCreationPdf = creation.id;
  downloadPdfButton.setAttribute("aria-label", `Télécharger ${creation.title} en PDF`);
  actions.append(downloadPdfButton);

  const deleteButton = createTextElement("button", "secondary-button delete-button", "Supprimer");
  deleteButton.type = "button";
  deleteButton.dataset.deleteCreation = creation.id;
  deleteButton.setAttribute("aria-label", `Supprimer ${creation.title}`);
  actions.append(deleteButton);

  content.append(actions);
  card.append(content);
  return card;
}

function createHistoryEntry(creation) {
  const entry = document.createElement("li");
  entry.className = "history-entry";

  const details = document.createElement("div");
  details.append(
    createTextElement("strong", "history-entry-title", creation.title),
    createTextElement("span", "history-entry-meta", `${templateNames[creation.template] || "Modèle"} · ${formatCreationDate(creation.createdAt)}`),
  );

  const openButton = createTextElement("button", "secondary-button", "Ouvrir");
  openButton.type = "button";
  openButton.dataset.openCreation = creation.id;
  entry.append(details, openButton);
  return entry;
}

function updateOverviewCounters() {
  const creations = readCreations();
  const count = creations.length;
  const creationValue = document.querySelector('.overview-card[href="#mes-creations"] .card-value');
  const historyValue = document.querySelector('.overview-card[href="#historique"] .card-value');

  if (creationValue) {
    const creationLabel = count === 1 ? "affiche" : "affiches";
    creationValue.innerHTML = `${count} <span>${creationLabel}</span>`;
    creationValue.classList.toggle("card-value-empty", count === 0);
  }

  if (historyValue) {
    const historyLabel = count === 1 ? "activité" : "activités";
    historyValue.innerHTML = `${count} <span>${historyLabel}</span>`;
    historyValue.classList.toggle("card-value-empty", count === 0);
  }
}

function renderSavedCreations() {
  if (!creationList || !historyList) return;

  const creations = readCreations().sort((first, second) => (
    new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  ));

  creationList.replaceChildren(...creations.map(createCreationCard));
  historyList.replaceChildren(...creations.map(createHistoryEntry));
  creationsEmpty.hidden = creations.length > 0;
  historyEmpty.hidden = creations.length > 0;
  updateOverviewCounters();
}

function renderRoute() {
  const requestedRoute = window.location.hash.slice(1) || "accueil";
  const route = Object.hasOwn(routes, requestedRoute) ? requestedRoute : "accueil";

  if (requestedRoute !== route) {
    window.history.replaceState(null, "", `#${route}`);
  }

  for (const view of views) {
    view.hidden = view.dataset.view !== route;
  }

  for (const link of navigationLinks) {
    if (link.dataset.route === route) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  pageLabel.textContent = routes[route];
  document.title = `QUICKPOSTER — ${routes[route]}`;
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
renderSavedCreations();
window.addEventListener("storage", (event) => {
  if (event.key === storageKey) renderSavedCreations();
});

const form = document.querySelector("#poster-form");

if (form) {
  const statusMessage = document.querySelector("#form-status");
  const creationsStatus = document.querySelector("#creations-status");
  const poster = document.querySelector("#poster");
  const emptyPreview = document.querySelector("#preview-empty");
  const saveButton = document.querySelector("#save-creation");
  const downloadButton = document.querySelector("#download-png");
  const downloadPdfButton = document.querySelector("#download-pdf");
  const templateButtons = [...document.querySelectorAll("[data-template]")];
  const colorInputs = [
    document.querySelector("#background-color"),
    document.querySelector("#accent-color"),
  ];
  const requiredFields = [
    document.querySelector("#business-name"),
    document.querySelector("#business-type"),
    document.querySelector("#product"),
  ];
  const textFields = posterTextFields;
  let activeCreationId = null;
  let cachedPosterCanvas = null;
  let cachedPosterKey = null;
  let pendingPosterRender = null;
  let pendingPosterKey = null;
  let posterVersion = 0;

  const invalidatePosterCanvas = () => {
    posterVersion += 1;
    cachedPosterCanvas = null;
    cachedPosterKey = null;
  };

  const updateExportStatus = (statusElement, message, busy = true) => {
    statusElement.textContent = message;
    statusElement.setAttribute("aria-busy", String(busy));
  };

  const yieldToBrowser = () => new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    window.requestAnimationFrame(finish);
    timeoutId = window.setTimeout(finish, 50);
  });

  const setSaveButtonLabel = () => {
    saveButton.textContent = activeCreationId ? "Enregistrer les modifications" : "Enregistrer l’affiche";
  };

  const creationModeButtons = [...document.querySelectorAll("[data-creation-mode]")];
  const photoMethodPanel = document.querySelector("#photo-method-panel");
  const assistMethodPanel = document.querySelector("#assist-method-panel");
  const posterPhotoInput = document.querySelector("#poster-photo");
  let selectedPhotoUrl = null;

  creationModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      creationModeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-selected", active);
        item.setAttribute("aria-pressed", String(active));
      });
      const mode = button.dataset.creationMode;
      photoMethodPanel.hidden = mode !== "photo";
      assistMethodPanel.hidden = mode !== "assist";
      if (mode === "free") {
        statusMessage.textContent = "Mode libre : choisissez vos couleurs et modifiez directement les textes dans l’aperçu.";
      } else if (mode === "templates") {
        statusMessage.textContent = "Choisissez un modèle dans la zone d’aperçu.";
      }
    });
  });

  posterPhotoInput.addEventListener("change", () => {
    const file = posterPhotoInput.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      posterPhotoInput.value = "";
      statusMessage.textContent = "Choisissez une image PNG, JPG ou WebP de 5 Mo maximum.";
      return;
    }
    if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
    selectedPhotoUrl = URL.createObjectURL(file);
    let photo = poster.querySelector(".user-poster-photo");
    if (!photo) {
      photo = document.createElement("img");
      photo.className = "user-poster-photo";
      photo.alt = "Photo ajoutée à l’affiche";
      poster.prepend(photo);
    }
    photo.src = selectedPhotoUrl;
    poster.hidden = false;
    emptyPreview.hidden = true;
    invalidatePosterCanvas();
    statusMessage.textContent = "Photo ajoutée à l’aperçu. Générer ou télécharger l’affiche pour vérifier le résultat.";
  });

  document.querySelector("#suggest-poster-copy").addEventListener("click", () => {
    const business = document.querySelector("#business-name").value.trim();
    const type = document.querySelector("#business-type").value.trim();
    const product = document.querySelector("#product").value.trim();
    if (!business || !type || !product) {
      statusMessage.textContent = "Renseignez d’abord le nom, le type de commerce et le produit à promouvoir.";
      return;
    }
    const suggestion = `Découvrez chez ${business} : ${product} ! Une sélection pensée pour vous, dans votre ${type.toLowerCase()}. Venez nous rendre visite et trouvez votre prochain coup de cœur.`;
    document.querySelector("#promotion").value = suggestion;
    document.querySelector("#promotion").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#assist-method-copy").textContent = "Proposition ajoutée au champ « Texte promotionnel ». Vous pouvez la modifier librement.";
    statusMessage.textContent = "Proposition de texte créée à partir de vos informations. Elle n’utilise pas de service d’IA externe.";
  });

  const paletteButtons = [...document.querySelectorAll("[data-palette]")];

  const setPosterColors = () => {
    poster.style.setProperty("--poster-bg", colorInputs[0].value);
    poster.style.setProperty("--poster-accent", colorInputs[1].value);
    invalidatePosterCanvas();
  };

  paletteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      colorInputs[0].value = button.dataset.bg;
      colorInputs[1].value = button.dataset.accent;
      paletteButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      setPosterColors();
    });
  });

  colorInputs.forEach((input) => {
    input.addEventListener("input", () => {
      paletteButtons.forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
      });
    });
  });

  const updateTemplateSelection = (template) => {
    poster.className = `poster template-${template}`;
    invalidatePosterCanvas();
    templateButtons.forEach((button) => {
      const selected = button.dataset.template === template;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };

  const updateRequiredValidity = () => {
    requiredFields.forEach((field) => {
      field.setCustomValidity(field.value.trim() ? "" : "Ce champ est obligatoire.");
    });
  };

  const setPosterText = (fieldName, value) => {
    invalidatePosterCanvas();
    const element = poster.querySelector(`[data-poster-field="${fieldName}"]`);
    const text = value.trim();
    const lines = text.split("\n");
    element.replaceChildren(...lines.flatMap((line, index) => (
      index === 0 ? [document.createTextNode(line)] : [document.createElement("br"), document.createTextNode(line)]
    )));
    element.hidden = !text;
  };

  const readPosterText = (fieldName) => {
    const element = poster.querySelector(`[data-poster-field="${fieldName}"]`);
    const readNodeText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      if (node.nodeName === "BR") return "\n";

      const children = [...node.childNodes];
      return children.map((child, index) => {
        const text = readNodeText(child);
        const isBlock = child.nodeType === Node.ELEMENT_NODE && /^(DIV|P)$/.test(child.nodeName);
        return text + (isBlock && index < children.length - 1 ? "\n" : "");
      }).join("");
    };

    return readNodeText(element).replace(/\u00a0/g, " ").trim();
  };

  const applyPosterText = (targetPoster, fieldName, value) => {
    const element = targetPoster.querySelector(`[data-poster-field="${fieldName}"]`);
    const text = String(value || "").trim();
    const lines = text.split("\n");
    element.replaceChildren(...lines.flatMap((line, index) => (
      index === 0 ? [document.createTextNode(line)] : [document.createElement("br"), document.createTextNode(line)]
    )));
    element.hidden = !text;
  };

  const cleanFilename = (title, extension = "png") => {
    let filename = title
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 100);

    if (!filename || /^\.+$/.test(filename)) filename = "affiche";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename)) filename = `_${filename}`;
    return `${filename}.${extension}`;
  };

  const createExportPoster = (snapshot) => {
    const exportHost = document.createElement("div");
    exportHost.className = "studio-view export-host";
    exportHost.setAttribute("aria-hidden", "true");
    exportHost.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;z-index:-1;";

    const exportPoster = poster.cloneNode(true);
    exportPoster.removeAttribute("id");
    exportPoster.hidden = false;
    exportPoster.className = `poster template-${snapshot.template}`;
    exportPoster.style.setProperty("--poster-bg", snapshot.colors.background);
    exportPoster.style.setProperty("--poster-accent", snapshot.colors.accent);
    exportPoster.style.boxShadow = "none";

    textFields.forEach((fieldName) => applyPosterText(exportPoster, fieldName, snapshot.texts[fieldName]));

    exportPoster.querySelectorAll("[contenteditable]").forEach((element) => {
      element.removeAttribute("contenteditable");
      element.removeAttribute("role");
      element.style.outline = "none";
      element.style.cursor = "default";
      element.style.boxShadow = "none";
    });

    exportHost.style.width = `${snapshot.width}px`;
    exportHost.append(exportPoster);
    document.body.append(exportHost);
    return { exportHost, exportPoster };
  };

  const getPosterSnapshot = (creation = null) => {
    const activeTemplate = [...poster.classList]
      .map((className) => className.replace("template-", ""))
      .find((name) => Object.hasOwn(templateNames, name)) || "atelier";
    const template = Object.hasOwn(templateNames, creation?.template) ? creation.template : activeTemplate;
    const texts = creation
      ? Object.fromEntries(textFields.map((fieldName) => [fieldName, String(creation.texts?.[fieldName] || "").trim()]))
      : Object.fromEntries(textFields.map((fieldName) => [fieldName, readPosterText(fieldName)]));
    const colors = {
      background: /^#[\da-f]{6}$/i.test(creation?.colors?.background || "")
        ? creation.colors.background
        : colorInputs[0].value,
      accent: /^#[\da-f]{6}$/i.test(creation?.colors?.accent || "")
        ? creation.colors.accent
        : colorInputs[1].value,
    };

    return {
      template,
      texts,
      colors,
      width: poster.getBoundingClientRect().width || 290,
      scale: 2,
    };
  };

  const renderPosterCanvas = async (snapshot, onProgress) => {
    let exportHost;
    try {
      if (typeof window.html2canvas !== "function") {
        throw new Error("La bibliothèque de rendu d’affiche n’est pas disponible.");
      }
      if (document.fonts?.status === "loading") await document.fonts.ready;
      const exportTree = createExportPoster(snapshot);
      exportHost = exportTree.exportHost;
      const { exportPoster } = exportTree;
      const posterBounds = exportPoster.getBoundingClientRect();
      const sourceWidth = Math.ceil(posterBounds.width);
      const sourceHeight = Math.ceil(posterBounds.height);
      if (!sourceWidth || !sourceHeight) throw new Error("Dimensions de l’affiche indisponibles.");

      onProgress("Rendu de l’affiche…");
      await yieldToBrowser();
      return await window.html2canvas(exportPoster, {
        allowTaint: false,
        backgroundColor: null,
        height: sourceHeight,
        logging: false,
        onclone: (clonedDocument) => {
          const clonedHost = clonedDocument.querySelector(".export-host");
          if (clonedHost) clonedHost.style.visibility = "visible";
        },
        scale: snapshot.scale,
        scrollX: 0,
        scrollY: 0,
        width: sourceWidth,
        windowHeight: Math.max(window.innerHeight, sourceHeight),
        windowWidth: Math.max(window.innerWidth, sourceWidth),
        x: 0,
        y: 0,
      });
    } finally {
      exportHost?.remove();
    }
  };

  const getPosterCanvas = async (creation, onProgress) => {
    if (!creation && poster.hidden) throw new Error("Générez d’abord l’aperçu de l’affiche.");
    const snapshot = getPosterSnapshot(creation);
    const key = JSON.stringify(snapshot);
    if (cachedPosterKey === key && cachedPosterCanvas) {
      onProgress("Réutilisation de l’aperçu…");
      return cachedPosterCanvas;
    }
    if (pendingPosterKey === key && pendingPosterRender) {
      onProgress("Rendu de l’affiche…");
      return pendingPosterRender;
    }

    onProgress("Préparation de l’affiche…");
    await yieldToBrowser();
    const version = posterVersion;
    pendingPosterKey = key;
    pendingPosterRender = renderPosterCanvas(snapshot, onProgress);
    try {
      const canvas = await pendingPosterRender;
      if (version === posterVersion && pendingPosterKey === key) {
        cachedPosterCanvas = canvas;
        cachedPosterKey = key;
      }
      return canvas;
    } finally {
      if (pendingPosterKey === key) {
        pendingPosterKey = null;
        pendingPosterRender = null;
      }
    }
  };

  const createPdfBlob = async (canvas, onProgress) => {
    onProgress("Conversion de l’image pour le PDF…");
    await yieldToBrowser();
    const jpegBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Création de l’image PDF impossible.")), "image/jpeg", 0.94);
    });
    if (jpegBlob.type !== "image/jpeg" || jpegBlob.size < 4) {
      throw new Error("Le navigateur n’a pas produit une image JPEG valide pour le PDF.");
    }

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 24;
    const fitScale = Math.min(
      (pageWidth - margin * 2) / canvas.width,
      (pageHeight - margin * 2) / canvas.height,
    );
    const imageWidth = canvas.width * fitScale;
    const imageHeight = canvas.height * fitScale;
    const imageX = (pageWidth - imageWidth) / 2;
    const imageY = (pageHeight - imageHeight) / 2;
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(
      `q\n${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${imageX.toFixed(2)} ${imageY.toFixed(2)} cm\n/Poster Do\nQ\n`,
    );
    const parts = [];
    const offsets = [0];
    let byteLength = 0;

    const append = (bytes) => {
      parts.push(bytes);
      byteLength += bytes.length;
    };
    const appendBlob = (blob) => {
      parts.push(blob);
      byteLength += blob.size;
    };
    const appendText = (text) => append(encoder.encode(text));
    const appendObject = (id, body) => {
      offsets[id] = byteLength;
      appendText(`${id} 0 obj\n${body}\nendobj\n`);
    };

    appendText("%PDF-1.4\n");
    appendObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
    appendObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    appendObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Poster 4 0 R >> >> /Contents 5 0 R >>`);

    offsets[4] = byteLength;
    appendText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBlob.size} >>\nstream\n`);
    appendBlob(jpegBlob);
    appendText("\nendstream\nendobj\n");

    offsets[5] = byteLength;
    appendText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    append(contentBytes);
    appendText("endstream\nendobj\n");

    onProgress("Assemblage du PDF…");
    await yieldToBrowser();
    const xrefOffset = byteLength;
    appendText(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (let id = 1; id < offsets.length; id += 1) {
      appendText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    }
    appendText(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  };

  const downloadPosterPng = async (creation = null, onProgress = () => {}) => {
    let pngUrl;
    try {
      const canvas = await getPosterCanvas(creation, onProgress);

      onProgress("Création du fichier PNG…");
      await yieldToBrowser();
      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Création du PNG impossible.")), "image/png");
      });
      if (pngBlob.type !== "image/png" || pngBlob.size < 8) {
        throw new Error("Le navigateur n’a pas produit un fichier PNG valide.");
      }

      const signature = new Uint8Array(await pngBlob.slice(0, 8).arrayBuffer());
      const expectedSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!expectedSignature.every((value, index) => signature[index] === value)) {
        throw new Error("Le fichier généré ne possède pas une signature PNG valide.");
      }

      pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = cleanFilename(creation?.title || readPosterText("businessName"));
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const downloadUrl = pngUrl;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      pngUrl = null;

      return {
        filename: cleanFilename(creation?.title || readPosterText("businessName")),
        size: pngBlob.size,
      };
    } finally {
      if (pngUrl) URL.revokeObjectURL(pngUrl);
    }
  };

  const downloadPosterPdf = async (creation = null, onProgress = () => {}) => {
    let pdfUrl;
    try {
      const canvas = await getPosterCanvas(creation, onProgress);
      const pdfBlob = await createPdfBlob(canvas, onProgress);
      if (pdfBlob.type !== "application/pdf" || pdfBlob.size < 100) {
        throw new Error("Le navigateur n’a pas produit un fichier PDF valide.");
      }

      const signature = new Uint8Array(await pdfBlob.slice(0, 5).arrayBuffer());
      if (new TextDecoder().decode(signature) !== "%PDF-") {
        throw new Error("Le fichier généré ne possède pas une signature PDF valide.");
      }

      pdfUrl = URL.createObjectURL(pdfBlob);
      const filename = cleanFilename(creation?.title || readPosterText("businessName"), "pdf");
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = filename;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const downloadUrl = pdfUrl;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      pdfUrl = null;

      return { filename, size: pdfBlob.size };
    } finally {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    }
  };

  const buildCreationData = () => {
    const texts = Object.fromEntries(textFields.map((fieldName) => [fieldName, readPosterText(fieldName)]));
    const template = [...poster.classList]
      .find((className) => Object.hasOwn(templateNames, className.replace("template-", "")))
      ?.replace("template-", "") || "atelier";

    return {
      title: texts.businessName,
      subtitle: texts.businessType,
      texts,
      template,
      colors: {
        background: colorInputs[0].value,
        accent: colorInputs[1].value,
      },
    };
  };

  const creationFingerprint = (creation) => JSON.stringify({
    title: creation.title,
    subtitle: creation.subtitle,
    texts: creation.texts,
    template: creation.template,
    colors: creation.colors,
  });

  const openCreation = (creationId) => {
    const creation = readCreations().find((item) => item.id === creationId);
    if (!creation) return;

    activeCreationId = creation.id;
    textFields.forEach((fieldName) => {
      const field = form.elements.namedItem(fieldName);
      if (field) field.value = creation.texts[fieldName] || "";
      setPosterText(fieldName, creation.texts[fieldName] || "");
    });

    colorInputs[0].value = creation.colors.background;
    colorInputs[1].value = creation.colors.accent;
    setPosterColors();
    updateTemplateSelection(creation.template);
    poster.hidden = false;
    emptyPreview.hidden = true;
    saveButton.disabled = false;
    downloadButton.disabled = false;
    downloadPdfButton.disabled = false;
    setSaveButtonLabel();
    statusMessage.textContent = "Création ouverte. Vous pouvez la modifier puis enregistrer les changements.";
    window.location.hash = "nouvelle-affiche";
  };

  requiredFields.forEach((field) => {
    field.addEventListener("input", () => {
      invalidatePosterCanvas();
      updateRequiredValidity();
      statusMessage.textContent = "";
    });
  });

  form.querySelectorAll("[name]").forEach((field) => {
    field.addEventListener("input", invalidatePosterCanvas);
    field.addEventListener("change", invalidatePosterCanvas);
  });

  poster.addEventListener("input", invalidatePosterCanvas);

  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateTemplateSelection(button.dataset.template);
    });
  });

  colorInputs.forEach((input) => {
    input.addEventListener("input", setPosterColors);
    input.addEventListener("change", setPosterColors);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateRequiredValidity();

    if (!form.reportValidity()) {
      statusMessage.textContent = "Veuillez renseigner les champs obligatoires.";
      return;
    }

    const data = new FormData(form);
    setPosterText("businessName", data.get("businessName"));
    setPosterText("businessType", data.get("businessType"));
    setPosterText("description", data.get("description"));
    setPosterText("product", data.get("product"));
    setPosterText("promotion", data.get("promotion"));
    setPosterText("price", data.get("price"));
    setPosterText("contact", data.get("contact"));
    setPosterColors();
    poster.hidden = false;
    emptyPreview.hidden = true;
    saveButton.disabled = false;
    downloadButton.disabled = false;
    downloadPdfButton.disabled = false;
    statusMessage.textContent = "Votre aperçu est prêt. Cliquez sur un texte pour le modifier.";
  });

  downloadButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    downloadPdfButton.disabled = true;
    try {
      const { filename, size } = await downloadPosterPng(null, (message) => updateExportStatus(statusMessage, message));
      updateExportStatus(statusMessage, `PNG généré (${Math.ceil(size / 1024)} Ko). Demande de téléchargement envoyée pour « ${filename} ».`, false);
    } catch (error) {
      console.error("Échec de l’export PNG", error);
      updateExportStatus(statusMessage, "L’export PNG a échoué. Vérifiez que le navigateur autorise le téléchargement.", false);
    } finally {
      downloadButton.disabled = poster.hidden;
      downloadPdfButton.disabled = poster.hidden;
    }
  });

  downloadPdfButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    downloadPdfButton.disabled = true;
    try {
      const { filename, size } = await downloadPosterPdf(null, (message) => updateExportStatus(statusMessage, message));
      updateExportStatus(statusMessage, `PDF généré (${Math.ceil(size / 1024)} Ko). Demande de téléchargement envoyée pour « ${filename} ».`, false);
    } catch (error) {
      console.error("Échec de l’export PDF", error);
      updateExportStatus(statusMessage, "L’export PDF a échoué. Vérifiez que le navigateur autorise le téléchargement.", false);
    } finally {
      downloadButton.disabled = poster.hidden;
      downloadPdfButton.disabled = poster.hidden;
    }
  });

  saveButton.addEventListener("click", async () => {
    if (poster.hidden) return;

    updateRequiredValidity();
    if (!form.reportValidity()) {
      statusMessage.textContent = "Veuillez renseigner les champs obligatoires.";
      return;
    }

    const data = buildCreationData();
    if (!data.title || !data.subtitle || !data.texts.product) {
      statusMessage.textContent = "Le titre, le sous-titre et le produit sont obligatoires.";
      return;
    }

    const creations = readCreations();
    const existing = creations.find((creation) => creation.id === activeCreationId);
    const duplicate = existing || creations.find((creation) => (
      creationFingerprint(creation) === creationFingerprint(data)
    ));

    const creation = {
      ...data,
      id: duplicate?.id || crypto.randomUUID(),
      createdAt: duplicate?.createdAt || new Date().toISOString(),
    };

    const nextCreations = duplicate
      ? creations.map((item) => item.id === duplicate.id ? creation : item)
      : [creation, ...creations];

    saveButton.disabled = true;
    statusMessage.textContent = cloudUser
      ? "Enregistrement sécurisé dans votre compte…"
      : "Enregistrement sur cet appareil…";
    try {
      if (cloudUser) await saveCloudCreation(creation);
      window.localStorage.setItem(storageKey, JSON.stringify(nextCreations));
      activeCreationId = creation.id;
      setSaveButtonLabel();
      renderSavedCreations();
      statusMessage.textContent = duplicate
        ? "Modifications enregistrées."
        : (cloudUser ? "Affiche enregistrée dans votre compte." : "Affiche enregistrée sur cet appareil. Connectez-vous pour la retrouver sur vos autres appareils.");
    } catch (error) {
      console.error("Échec de l’enregistrement", error);
      statusMessage.textContent = cloudUser
        ? "La synchronisation avec votre compte a échoué. Vérifiez votre connexion puis réessayez."
        : "Impossible d’enregistrer cette affiche sur cet appareil.";
    } finally {
      saveButton.disabled = false;
    }
  });

  document.querySelectorAll('a[href="#nouvelle-affiche"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (link.dataset.openCreation) return;
      activeCreationId = null;
      setSaveButtonLabel();
    });
  });

  document.addEventListener("click", async (event) => {
    const pdfExportButton = event.target.closest("[data-download-creation-pdf]");
    if (pdfExportButton) {
      const creation = readCreations().find((item) => item.id === pdfExportButton.dataset.downloadCreationPdf);
      if (!creation) return;

      pdfExportButton.disabled = true;
      downloadPosterPdf(creation, (message) => updateExportStatus(creationsStatus, message))
        .then(({ filename, size }) => {
          updateExportStatus(creationsStatus, `PDF généré (${Math.ceil(size / 1024)} Ko). Demande de téléchargement envoyée pour « ${filename} ».`, false);
        })
        .catch((error) => {
          console.error("Échec de l’export PDF", error);
          updateExportStatus(creationsStatus, "L’export PDF a échoué. Vérifiez que le navigateur autorise le téléchargement.", false);
        })
        .finally(() => {
          pdfExportButton.disabled = false;
        });
      return;
    }

    const exportButton = event.target.closest("[data-download-creation]");
    if (exportButton) {
      const creation = readCreations().find((item) => item.id === exportButton.dataset.downloadCreation);
      if (!creation) return;

      exportButton.disabled = true;
      downloadPosterPng(creation, (message) => updateExportStatus(creationsStatus, message))
        .then(({ filename, size }) => {
          updateExportStatus(creationsStatus, `PNG généré (${Math.ceil(size / 1024)} Ko). Demande de téléchargement envoyée pour « ${filename} ».`, false);
        })
        .catch((error) => {
          console.error("Échec de l’export PNG", error);
          updateExportStatus(creationsStatus, "L’export PNG a échoué. Vérifiez que le navigateur autorise le téléchargement.", false);
        })
        .finally(() => {
          exportButton.disabled = false;
        });
      return;
    }

    const openButton = event.target.closest("[data-open-creation]");
    if (openButton) {
      openCreation(openButton.dataset.openCreation);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-creation]");
    if (!deleteButton) return;

    const creations = readCreations();
    const creation = creations.find((item) => item.id === deleteButton.dataset.deleteCreation);
    if (!creation || !window.confirm(`Supprimer « ${creation.title} » ?`)) return;

    deleteButton.disabled = true;
    try {
      if (cloudUser) await deleteCloudCreation(creation.id);
      window.localStorage.setItem(storageKey, JSON.stringify(
        creations.filter((item) => item.id !== creation.id),
      ));
      if (activeCreationId === creation.id) {
        activeCreationId = null;
        setSaveButtonLabel();
      }
      renderSavedCreations();
      statusMessage.textContent = "Affiche supprimée.";
    } catch (error) {
      console.error("Échec de la suppression", error);
      statusMessage.textContent = "Impossible de supprimer cette affiche. Réessayez.";
    } finally {
      deleteButton.disabled = false;
    }
  });

  updateRequiredValidity();
  setSaveButtonLabel();
}
