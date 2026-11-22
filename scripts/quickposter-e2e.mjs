import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';

const baseUrl = 'http://127.0.0.1:4174';
const artifactDir = 'visual-preview';
const downloadDir = path.join(artifactDir, 'downloads');
fs.mkdirSync(downloadDir, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', '4174', '--directory', 'docs'], {
  stdio: 'ignore',
});
const runtimeErrors = [];
const consoleErrors = [];
const accessibility = [];
const results = [];
const warnings = [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error('Le serveur local QUICKPOSTER ne démarre pas.');
}

async function preparePage(page, options = {}) {
  await page.route(
    (url) => url.toString().startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0'),
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );

  await page.addInitScript((quotaPreference) => {
    const auth = {
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signUp() {
        return { data: { user: null, session: null }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: null };
      },
      async verifyOtp() {
        return { data: { user: null, session: null }, error: null };
      },
      async resend() {
        return { data: {}, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async updateUser() {
        return { data: { user: null }, error: null };
      },
    };
    const client = {
      auth,
      from() {
        const query = {
          select() { return query; },
          eq() { return query; },
          order: async () => ({ data: [], error: null }),
          upsert: async () => ({ error: null }),
          delete() { return query; },
        };
        return query;
      },
    };
    window.supabase = { createClient: () => client };

    if (quotaPreference) {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'quickposter-theme') {
          throw new DOMException('Stockage indisponible pour le test', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };
    }
  }, Boolean(options.quotaPreference));

  page.on('pageerror', (error) => {
    runtimeErrors.push({ page: page.url(), message: error.message });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ page: page.url(), message: message.text() });
  });
}

async function navigateTo(page, route, mobile) {
  if (mobile) {
    const toggle = page.locator('#mobile-menu-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  }
  await page.locator('[data-route="' + route + '"]').click();
  await page.locator('[data-view="' + route + '"]').waitFor({ state: 'visible' });
  if (mobile) {
    assert.equal(await page.locator('#mobile-menu-toggle').getAttribute('aria-expanded'), 'false');
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1
  ));
  assert.equal(overflow, false, label + ': débordement horizontal');
}

async function runAccessibility(page, browserName, viewportName, route) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const entry = {
    browser: browserName,
    viewport: viewportName,
    route,
    violations: report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
      targets: violation.nodes.map((node) => ({
        selector: node.target,
        summary: node.failureSummary || '',
      })),
    })),
  };
  accessibility.push(entry);
  const blockers = report.violations.filter((violation) => (
    violation.impact === 'critical' || violation.impact === 'serious'
  ));
  assert.equal(
    blockers.length,
    0,
    browserName + '/' + viewportName + '/' + route + ': violations WCAG sérieuses ou critiques: ' +
      blockers.map((item) => item.id).join(', '),
  );
}

async function verifyDownload(page, button, kind, expectedFilename, statusSelector, label) {
  const startedAt = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 }).then(
    (download) => ({ download }),
    (error) => ({ error }),
  );
  await button.click();
  await page.waitForFunction(
    ({ selector, extension }) => {
      const message = document.querySelector(selector)?.textContent || '';
      return message.includes(`${extension.toUpperCase()} généré`) ||
        message.includes(`L’export ${extension.toUpperCase()} a échoué`);
    },
    { selector: statusSelector, extension: kind },
    { timeout: 45000 },
  ).catch(async (error) => {
    const status = await page.locator(statusSelector).textContent().catch(() => '<statut indisponible>');
    const recentErrors = consoleErrors.slice(-5).map((entry) => entry.message).join(' | ');
    throw new Error(`${label}: aucun résultat d’export après le clic. Statut: ${status}. Console: ${recentErrors || 'aucune erreur console capturée'}. ${error.message}`);
  });
  const statusText = await page.locator(statusSelector).textContent();
  const recentErrors = consoleErrors.slice(-8).map((entry) => entry.message).join(' | ');
  assert.ok(statusText.includes(`${kind.toUpperCase()} généré`), `${label}: ${statusText}. Console: ${recentErrors || 'aucune erreur console capturée'}`);
  const downloadResult = await downloadPromise;
  assert.ok(downloadResult.download, `${label}: export annoncé mais téléchargement absent. ${downloadResult.error?.message || ''}`);
  const download = downloadResult.download;
  assert.equal(download.suggestedFilename(), expectedFilename, label + ': nom de fichier');
  const outputPath = path.join(downloadDir, label.replace(/[^a-z0-9_-]/gi, '-') + '-' + kind + '-' + Date.now() + '.' + kind);
  await download.saveAs(outputPath);
  const bytes = fs.readFileSync(outputPath);

  if (kind === 'png') {
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
      label + ': signature PNG',
    );
    const decoded = PNG.sync.read(bytes);
    assert.ok(decoded.width >= 1000, label + ': largeur PNG insuffisante');
    assert.ok(decoded.height >= 1000, label + ': hauteur PNG insuffisante');
    const ratio = decoded.width / decoded.height;
    assert.ok(ratio > 0.65 && ratio < 0.9, label + ': proportions PNG inattendues');
    const colors = new Set();
    for (let index = 0; index < decoded.data.length; index += 400) {
      colors.add(
        decoded.data[index] + ',' +
        decoded.data[index + 1] + ',' +
        decoded.data[index + 2],
      );
      if (colors.size > 20) break;
    }
    assert.ok(colors.size > 5, label + ': image PNG vide ou uniforme');
    results.push({
      label,
      kind,
      filename: download.suggestedFilename(),
      bytes: bytes.length,
      width: decoded.width,
      height: decoded.height,
      durationMs: Date.now() - startedAt,
      path: outputPath,
    });
  } else {
    assert.ok(bytes.length > 500, label + ': PDF trop petit');
    assert.equal(bytes.subarray(0, 8).toString('ascii').slice(0, 5), '%PDF-', label + ': signature PDF');
    const pdfText = bytes.toString('latin1');
    assert.ok(pdfText.includes('/Subtype /Image'), label + ': image absente du PDF');
    assert.ok(pdfText.includes('/Filter /DCTDecode'), label + ': image JPEG absente du PDF');
    assert.ok(pdfText.includes('/MediaBox [0 0 595.28 841.89]'), label + ': format A4 absent');
    const startXref = pdfText.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
    assert.ok(startXref, label + ': table xref PDF absente');
    const xrefOffset = Number(startXref[1]);
    assert.equal(bytes.subarray(xrefOffset, xrefOffset + 4).toString('ascii'), 'xref', label + ': offset xref invalide');
    const parsed = await PDFDocument.load(bytes);
    assert.equal(parsed.getPageCount(), 1, label + ': nombre de pages PDF');
    const size = parsed.getPage(0).getSize();
    assert.ok(Math.abs(size.width - 595.28) < 0.1, label + ': largeur PDF');
    assert.ok(Math.abs(size.height - 841.89) < 0.1, label + ': hauteur PDF');
    results.push({
      label,
      kind,
      filename: download.suggestedFilename(),
      bytes: bytes.length,
      pages: parsed.getPageCount(),
      width: size.width,
      height: size.height,
      durationMs: Date.now() - startedAt,
      path: outputPath,
    });
  }

  await page.waitForFunction(
    ({ selector, phrase }) => (document.querySelector(selector)?.textContent || '').includes(phrase),
    { selector: statusSelector, phrase: kind.toUpperCase() + ' généré' },
    { timeout: 120000 },
  );
  assert.equal(await page.locator(statusSelector).getAttribute('aria-busy'), 'false');
  return outputPath;
}

async function fillPoster(page, title, template, headline) {
  await page.locator('#business-name').fill(title);
  await page.locator('#business-type').fill('Commerce');
  await page.locator('#business-description').fill('');
  await page.locator('#product').fill('Produit test');
  await page.locator('#headline').fill(headline || '');
  await page.locator('#promotion').fill('');
  await page.locator('#price').fill('');
  await page.locator('#contact').fill('');
  await page.locator('.template-option[data-template="' + template + '"]').click();
  await page.locator('#poster-form button[type="submit"]').click();
  await page.locator('#poster:not([hidden])').waitFor({ state: 'visible' });
}

async function testResponsiveAndAccessibility(browser, browserName) {
  const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await preparePage(page);
    await page.goto(baseUrl + '/#accueil', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-view="accueil"]').waitFor({ state: 'visible' });

    for (const route of ['accueil', 'nouvelle-affiche', 'mes-creations', 'historique']) {
      await navigateTo(page, route, viewport.width <= 760);
      await assertNoHorizontalOverflow(page, browserName + '/' + viewport.name + '/' + route);
      if (browserName === 'chromium') {
        await runAccessibility(page, browserName, viewport.name, route);
      }
    }

    if (viewport.width <= 760) {
      const toggle = page.locator('#mobile-menu-toggle');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }

    const before = await page.locator('body').getAttribute('data-theme');
    await page.locator('#theme-quick-toggle').click();
    const after = await page.locator('body').getAttribute('data-theme');
    assert.notEqual(after, before, browserName + '/' + viewport.name + ': bascule de thème');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(
      await page.locator('body').getAttribute('data-theme'),
      after,
      browserName + '/' + viewport.name + ': préférence de thème non conservée',
    );

    await context.close();
  }
}

async function testExports() {
  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
  const page = await context.newPage();
  await preparePage(page);
  await page.goto(baseUrl + '/#nouvelle-affiche', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.html2canvas === 'function');

  const creations = [
    { title: 'Café / Boutique', template: 'atelier', headline: 'Offre test' },
    { title: 'Impact test', template: 'impact', headline: 'Promotion test' },
    { title: 'Editorial test', template: 'editorial', headline: 'Nouveauté test' },
  ];

  for (let index = 0; index < creations.length; index += 1) {
    const creation = creations[index];
    if (index > 0) await page.locator('[data-route="nouvelle-affiche"]').click();
    await fillPoster(page, creation.title, creation.template, creation.headline);

    if (index === 0) {
      await page.evaluate(() => {
        const original = window.html2canvas.bind(window);
        window.__quickposterRenderCount = 0;
        window.html2canvas = (...args) => {
          window.__quickposterRenderCount += 1;
          return original(...args);
        };
      });
    }

    const expectedPng = (index === 0 ? 'Café - Boutique' : creation.title) + '.png';
    const expectedPdf = (index === 0 ? 'Café - Boutique' : creation.title) + '.pdf';
    const studioPng = await verifyDownload(
      page,
      page.locator('#download-png'),
      'png',
      expectedPng,
      '#form-status',
      'studio-' + creation.template,
    );
    const studioPdf = await verifyDownload(
      page,
      page.locator('#download-pdf'),
      'pdf',
      expectedPdf,
      '#form-status',
      'studio-' + creation.template,
    );

    if (index === 0) {
      assert.equal(
        await page.evaluate(() => window.__quickposterRenderCount),
        1,
        'Le rendu PNG puis PDF doit réutiliser le même canvas.',
      );

      await page.locator('#headline').fill('Offre modifiée');
      await page.locator('#poster-form button[type="submit"]').click();
      const changedTextPng = await verifyDownload(
        page,
        page.locator('#download-png'),
        'png',
        expectedPng,
        '#form-status',
        'cache-texte-modifie',
      );
      assert.equal(
        await page.evaluate(() => window.__quickposterRenderCount),
        2,
        'Le changement de texte doit invalider le canvas mis en cache.',
      );
      assert.notDeepEqual(
        fs.readFileSync(studioPng),
        fs.readFileSync(changedTextPng),
        'Le PNG doit refléter le texte modifié.',
      );

      await page.locator('#background-color').fill('#e8f4f7');
      await page.locator('#poster-form button[type="submit"]').click();
      await verifyDownload(
        page,
        page.locator('#download-png'),
        'png',
        expectedPng,
        '#form-status',
        'cache-couleur-modifiee',
      );
      assert.equal(
        await page.evaluate(() => window.__quickposterRenderCount),
        3,
        'Le changement de couleur doit invalider le canvas mis en cache.',
      );
      await page.locator('#headline').fill(creation.headline);
      await page.locator('#background-color').fill('#f4efe6');
      await page.locator('#poster-form button[type="submit"]').click();
    }

    await page.locator('#save-creation').click();
    await page.waitForFunction(
      (expected) => {
        try {
          return JSON.parse(localStorage.getItem('quickposter.creations.v1') || '[]').length === expected;
        } catch {
          return false;
        }
      },
      index + 1,
      { timeout: 15000 },
    );
    assert.ok(fs.existsSync(studioPdf), 'Le PDF du studio doit être présent.');
  }

  await page.locator('[data-route="mes-creations"]').click();
  await page.locator('.creation-card').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.creation-card').count(), 3, 'Les trois créations doivent être enregistrées.');
  assert.equal(await page.locator('#history-list .history-entry').count(), 3, 'L’historique doit refléter les créations sauvegardées.');

  for (const creation of creations) {
    const card = page.locator('.creation-card').filter({ hasText: creation.title });
    await card.waitFor({ state: 'visible' });
    const baseName = creation.title === 'Café / Boutique' ? 'Café - Boutique' : creation.title;
    await verifyDownload(
      page,
      card.locator('[data-download-creation]'),
      'png',
      baseName + '.png',
      '#creations-status',
      'bibliotheque-' + creation.template,
    );
    await verifyDownload(
      page,
      card.locator('[data-download-creation-pdf]'),
      'pdf',
      baseName + '.pdf',
      '#creations-status',
      'bibliotheque-' + creation.template,
    );
  }

  const duplicate = creations[1];
  await page.locator('[data-route="nouvelle-affiche"]').click();
  await fillPoster(page, duplicate.title, duplicate.template, duplicate.headline);
  await page.locator('#save-creation').click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('quickposter.creations.v1') || '[]').length === 3,
    null,
    { timeout: 15000 },
  );

  await page.locator('[data-route="mes-creations"]').click();
  const firstCard = page.locator('.creation-card').filter({ hasText: creations[0].title });
  page.once('dialog', (dialog) => dialog.accept());
  await firstCard.locator('[data-delete-creation]').click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('quickposter.creations.v1') || '[]').length === 2,
    null,
    { timeout: 15000 },
  );
  await page.locator('[data-route="accueil"]').click();
  assert.match(
    await page.locator('.overview-card[href="#mes-creations"] .card-value').textContent(),
    /2\s+affiches/,
    'Le compteur de créations doit être actualisé après suppression.',
  );
  assert.match(
    await page.locator('.overview-card[href="#historique"] .card-value').textContent(),
    /2\s+activités/,
    'Le compteur d’historique doit être actualisé après suppression.',
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-route="mes-creations"]').click();
  assert.equal(await page.locator('.creation-card').count(), 2, 'Les créations doivent survivre au rechargement.');

  await page.evaluate(() => localStorage.setItem('quickposter.creations.v1', '{invalid-json'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-route="mes-creations"]').click();
  assert.equal(await page.locator('.creation-card').count(), 0, 'Une sauvegarde JSON corrompue ne doit pas casser la page.');
  assert.match(
    await page.locator('#creations-status').textContent(),
    /copie brute a été conservée/,
    'Une sauvegarde corrompue doit afficher un message de récupération.',
  );
  assert.deepEqual(
    await page.evaluate(() => Object.keys(localStorage)
      .filter((key) => key.startsWith('quickposter.creations.v1.corrupt-backup.'))
      .map((key) => localStorage.getItem(key))),
    ['{invalid-json'],
    'Le contenu brut corrompu doit être conservé une seule fois dans une copie de secours.',
  );

  } finally {
    await context?.close();
    await browser?.close();
  }
}

async function testPreferenceQuota() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await preparePage(page, { quotaPreference: true });
  await page.goto(baseUrl + '/#accueil', { waitUntil: 'domcontentloaded' });
  const before = await page.locator('body').getAttribute('data-theme');
  await page.locator('#theme-quick-toggle').click();
  const after = await page.locator('body').getAttribute('data-theme');
  assert.notEqual(after, before, 'Le changement de thème doit fonctionner même si le stockage local échoue.');
  assert.equal(runtimeErrors.length, 0, 'Aucune exception JavaScript ne doit être levée quand le stockage des préférences échoue.');
  await context.close();
  await browser.close();
}

try {
  await waitForServer();

  for (const engine of [
    { name: 'chromium', type: chromium },
    { name: 'firefox', type: firefox },
    { name: 'webkit', type: webkit },
  ]) {
    const browser = await engine.type.launch({ headless: true });
    try {
      await testResponsiveAndAccessibility(browser, engine.name);
    } finally {
      await browser.close();
    }
  }

  await testExports();
  await testPreferenceQuota();

  assert.equal(runtimeErrors.length, 0, 'Erreurs JavaScript non gérées: ' + JSON.stringify(runtimeErrors));
  const report = {
    status: 'passed',
    browsers: ['chromium', 'firefox', 'webkit'],
    responsiveViewports: ['1440x1000', '768x1024', '390x844'],
    routes: ['accueil', 'nouvelle-affiche', 'mes-creations', 'historique'],
    exportFiles: results,
    accessibility,
    runtimeErrors,
    consoleErrors,
    warnings,
  };
  fs.writeFileSync(path.join(artifactDir, 'functional-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('Tous les contrôles fonctionnels QUICKPOSTER ont réussi.');
} catch (error) {
  const report = {
    status: 'failed',
    error: error.stack || error.message,
    exportFiles: results,
    accessibility,
    runtimeErrors,
    consoleErrors,
    warnings,
  };
  fs.writeFileSync(path.join(artifactDir, 'functional-audit.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  server.kill();
}
