import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const auth = readFileSync("docs/auth.js", "utf8");
const html = readFileSync("docs/index.html", "utf8");
const app = readFileSync("docs/app.js", "utf8");
const styles = readFileSync("docs/styles.css", "utf8");

const checks = [
  ["Supabase client uses the intended project", auth.includes("https://yhghivyejpavymjcbqnr.supabase.co")],
  ["Signup sends an email verification code", auth.includes("client.auth.signUp({ email, password, options: { emailRedirectTo:") && auth.includes("data: { first_name:")],
  ["Email verification code is checked with Supabase", auth.includes('type: "signup"') && auth.includes("client.auth.verifyOtp(")],
  ["Users can request another verification code", auth.includes('client.auth.resend({ type: "signup"')],
  ["Signup uses Supabase email/password authentication", /client\.auth\.signUp\(/.test(auth)],
  ["Login uses Supabase email/password authentication", /client\.auth\.signInWithPassword\(/.test(auth)],
  ["Existing session is restored on page load", /client\.auth\.getSession\(/.test(auth)],
  ["Auth state changes update the interface", /client\.auth\.onAuthStateChange\(/.test(auth)],
  ["Logout is implemented", /client\.auth\.signOut\(/.test(auth)],
  ["The page loads the Supabase client before auth.js", html.indexOf("@supabase/supabase-js") < html.indexOf('src="auth.js?v=')],
  ["The poster editor is present", html.includes('id="poster-form"')],
  ["Poster creations can be saved to Supabase", app.includes('.from("creations")') && app.includes("saveCloudCreation")],
  ["Cloud records are queried for the signed-in user", app.includes('.eq("user_id", user.id)')],
  ["Local fallback remains available", app.includes("localStorage")],
  ["Verification-code resend button is restored after errors", auth.includes("finally {\n      resendButton.disabled = false;")],
  ["Profile form handles update failures", auth.includes('showStatus(error.message || "Impossible d’enregistrer le profil.", true);')],
  ["Password form handles update failures", auth.includes('showStatus(error.message || "Impossible de modifier le mot de passe.", true);')],
  ["Profile and password updates require an active user", (auth.match(/if \(!currentUser\) return;/g) || []).length >= 2],
  ["Sign-out button is restored after network errors", auth.includes("finally {\n      signoutButton.disabled = false;")],
  ["Session refresh handles rejected requests", auth.includes("async function refreshSession()") && auth.includes('showStatus(error.message || "Impossible de vérifier la session.", true);')],
  ["Initial session is loaded through the guarded refresh function", auth.includes("  refreshSession();")],
  ["Preference reads tolerate unavailable browser storage", auth.includes("const getLocalPreference = (key, fallback)") && auth.includes("return fallback;")],
  ["Preference writes tolerate storage quota or access errors", auth.includes("const setLocalPreference = (key, value)") && auth.includes("return false;")],
  ["Creation titles are rendered as text, not HTML", app.includes('createTextElement("h2", "creation-card-title", creation.title)')],
  ["Saved creations are normalized before use", app.includes("function normalizeCreation(creation)") && app.includes("stored.map(normalizeCreation).filter(Boolean)")],
  ["Saved template names are restricted to known templates", app.includes('Object.hasOwn(templateNames, creation.template) ? creation.template : "atelier"')],
  ["Saved colors accept only six-digit hex values", app.includes('/^#[\\da-f]{6}$/i.test(value || "")')],
  ["Saved photo data is restricted to bounded image data URLs", app.includes("candidate.data.length <= 5 * 1024 * 1024") && app.includes("/^data:image\\/(?:jpeg|png|webp);base64,")],
  ["Saved photo positions are finite and clamped", app.includes("Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback")],
  ["Poster export styles avoid color functions unsupported by html2canvas", !/\\b(?:color-mix|color|lab|lch|oklab|oklch)\\s*\\(/i.test(styles)],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed += 1;
}

assert.equal(failed, 0, `${failed} QUICKPOSTER check(s) failed.`);
console.log(`\nAll ${checks.length} project checks passed.`);
