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