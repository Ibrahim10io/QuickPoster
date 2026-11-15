(() => {
  const checkButton = document.querySelector("#ai-check-device");
  const loadButton = document.querySelector("#ai-load-model");
  const status = document.querySelector("#ai-compat-status");
  const details = document.querySelector("#ai-compat-details");
  if (!checkButton || !loadButton || !status || !details) return;

  const modelId = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC";
  let engine = null;
  let checked = false;
  const setStatus = (message) => { status.textContent = message; };

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("#suggest-poster-copy");
    if (!button || !engine) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const field = document.querySelector("#assist-poster-text");
    const statusField = document.querySelector("#form-status");
    const business = document.querySelector("#business-name")?.value.trim() || "";
    const type = document.querySelector("#business-type")?.value.trim() || "";
    const description = document.querySelector("#business-description")?.value.trim() || "";
    const product = document.querySelector("#product")?.value.trim() || "";
    const promotion = document.querySelector("#promotion")?.value.trim() || "";
    const price = document.querySelector("#price")?.value.trim() || "";
    const contact = document.querySelector("#contact")?.value.trim() || "";
    const request = field?.value.trim() || "Rédige une proposition publicitaire originale.";
    button.disabled = true;
    if (statusField) statusField.textContent = "L’IA rédige votre proposition…";
    try {
      const response = await engine.chat.completions.create({
        messages: [
          { role: "system", content: "Tu es l’assistant rédactionnel de QUICKPOSTER. Tu écris en français naturel, avec une bonne orthographe. Rédige un texte d’affiche concis et convaincant. N’invente jamais de prix, de promotion, de coordonnées ou de caractéristiques. Utilise uniquement les informations fournies. Réponds uniquement avec le texte prêt à afficher." },
          { role: "user", content: "Commerce : " + business + "\\nType : " + type + "\\nDescription : " + description + "\\nProduit/service : " + product + "\\nPromotion : " + promotion + "\\nPrix : " + price + "\\nCoordonnées : " + contact + "\\nDemande ou brouillon à améliorer : " + request }
        ],
        temperature: 0.75,
        max_tokens: 180
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Aucun texte reçu.");
      field.value = text;
      document.querySelector("#assist-method-copy").textContent = "Proposition générée par l’IA locale. Vous pouvez la modifier avant de l’ajouter à l’affiche.";
      if (statusField) statusField.textContent = "Texte généré par l’IA locale. Vérifiez-le, puis ajoutez-le à l’affiche.";
    } catch (error) {
      if (statusField) statusField.textContent = "La génération a échoué : " + (error?.message || "erreur inconnue");
    } finally {
      button.disabled = false;
    }
  }, true);

  checkButton.addEventListener("click", async () => {
    checkButton.disabled = true;
    loadButton.disabled = true;
    details.hidden = true;
    setStatus("Vérification de WebGPU et de l’appareil…");
    try {
      if (!("gpu" in navigator)) {
        throw new Error("WebGPU n’est pas disponible dans ce navigateur. Essayez une version récente de Chrome ou Edge.");
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("Aucun adaptateur graphique compatible n’a été détecté.");
      const device = await adapter.requestDevice();
      const info = adapter.info || {};
      const memory = navigator.deviceMemory ? navigator.deviceMemory + " Go (estimation du navigateur)" : "non communiquée par le navigateur";
      const cores = navigator.hardwareConcurrency || "inconnu";
      const adapterName = [info.vendor, info.architecture, info.device].filter(Boolean).join(" / ") || "nom masqué par le navigateur";
      device.destroy();
      checked = true;
      loadButton.disabled = false;
      details.hidden = false;
      details.textContent = "WebGPU : disponible · Carte : " + adapterName + " · Mémoire système estimée : " + memory + " · Cœurs CPU logiques : " + cores + ". Le test confirme l’accès WebGPU, pas encore la capacité à charger un grand modèle.";
      setStatus("Bon signe : votre navigateur sait accéder au GPU. Vous pouvez lancer le test IA, qui téléchargera environ 1 Go de données une seule fois.");
    } catch (error) {
      checked = false;
      setStatus("Compatibilité insuffisante : " + (error?.message || "échec du test") + " Aucun modèle n’a été téléchargé.");
      details.hidden = false;
      details.textContent = "QUICKPOSTER gardera ses fonctions habituelles. Aucune dépense n’a été effectuée.";
    } finally {
      checkButton.disabled = false;
    }
  });

  loadButton.addEventListener("click", async () => {
    if (!checked || engine) return;
    loadButton.disabled = true;
    checkButton.disabled = true;
    setStatus("Téléchargement et préparation du modèle léger Qwen 0.5B… Cela peut prendre plusieurs minutes. Gardez cette page ouverte.");
    try {
      const webllm = await import("https://esm.run/@mlc-ai/web-llm");
      engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => setStatus("Préparation de l’IA : " + (progress.text || "chargement…"))
      });
      setStatus("Modèle chargé. Test de rédaction en français…");
      const test = await engine.chat.completions.create({
        messages: [
          { role: "system", content: "Tu es l’assistant rédactionnel de QUICKPOSTER. Réponds en français clair et rédige des textes publicitaires courts, naturels et honnêtes." },
          { role: "user", content: "Écris une courte accroche publicitaire pour une boulangerie qui propose des croissants frais." }
        ],
        temperature: 0.7,
        max_tokens: 100
      });
      const sample = test.choices?.[0]?.message?.content?.trim();
      if (!sample) throw new Error("Le modèle s’est chargé mais n’a pas produit de texte.");
      window.quickPosterLocalAIEngine = engine;
      window.quickPosterLocalAIModel = modelId;
      details.hidden = false;
      details.textContent = "Modèle testé : " + modelId + " · Exemple généré : " + sample;
      setStatus("Test réussi ! Le modèle fonctionne sur cet appareil. Le bouton « Proposer un texte » peut maintenant utiliser cette IA locale.");
      const suggestButton = document.querySelector("#suggest-poster-copy");
      if (suggestButton) suggestButton.textContent = "Générer avec l’IA";
    } catch (error) {
      engine = null;
      setStatus("Le modèle n’a pas pu démarrer sur cet appareil : " + (error?.message || "erreur inconnue") + ". Aucun service payant n’a été utilisé.");
      details.hidden = false;
      details.textContent = "On pourra ensuite essayer un modèle plus petit, après avoir récupéré ce résultat de test.";
    } finally {
      checkButton.disabled = false;
      loadButton.disabled = Boolean(engine);
    }
  });
})();