import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const auth = readFileSync("docs/auth.js", "utf8");
const html = readFileSync("docs/index.html", "utf8");
const app = readFileSync("docs/app.js", "utf8");

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
  ["Creation titles are rendered as text, not HTML", app.includes('createTextElement("h2", "creation-card-title", creation.title)')],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed += 1;
}

assert.equal(failed, 0, `${failed} QUICKPOSTER check(s) failed.`);
console.log(`\nAll ${checks.length} project checks passed.`);
