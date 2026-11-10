import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const auth = readFileSync("docs/auth.js", "utf8");
const html = readFileSync("docs/index.html", "utf8");
const app = readFileSync("docs/app.js", "utf8");

const checks = [
  ["Supabase client uses the intended project", auth.includes("https://yhghivyejpavymjcbqnr.supabase.co")],
  ["Signup redirects to the public QUICKPOSTER homepage", auth.includes('emailRedirectTo: "https://ibrahim10io.github.io/QuickPoster/"')],
  ["Signup uses Supabase email/password authentication", /client\.auth\.signUp\(/.test(auth)],
  ["Login uses Supabase email/password authentication", /client\.auth\.signInWithPassword\(/.test(auth)],
  ["Existing session is restored on page load", /client\.auth\.getSession\(/.test(auth)],
  ["Auth state changes update the interface", /client\.auth\.onAuthStateChange\(/.test(auth)],
  ["Logout is implemented", /client\.auth\.signOut\(/.test(auth)],
  ["The page loads the Supabase client before auth.js", html.indexOf("@supabase/supabase-js") < html.indexOf('src="auth.js"')],
  ["The poster editor is present", html.includes('id="poster-form"')],
  ["Poster data is currently stored locally (known pre-launch limitation)", app.includes("localStorage")],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed += 1;
}

assert.equal(failed, 0, `${failed} QUICKPOSTER check(s) failed.`);
console.log(`\\nAll ${checks.length} project checks passed.`);
