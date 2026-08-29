#!/usr/bin/env node
// tools/check-toplevel.mjs — node T1, seat I2.
//
// WHAT IT PROVES. Zero registerTool call sites are reachable from an iframe entry
// file or a worker entry file. Registration has to happen in the top-level document,
// because a tool registered inside a frame is never discovered by the agent — same
// origin or not (HANDOVER §3 rule 11, MEASURED). A frame is not a weaker place to
// register; it is a place where registration silently does nothing, which is worse,
// because the page looks correct and the surface is empty.
//
// HOW IT IS INVOKED. Paths arrive on argv, one per file:
//
//   find src/page -name '*.js' -print0 | xargs -0 node tools/check-toplevel.mjs
//
// argv, not a glob. `src/page/**/*.js` needs `shopt -s globstar`; under plain sh that
// glob matches ONE directory level and the check passes vacuously over a tree whose
// violations are all nested. find|xargs is shell-independent.
//
// HOW IT WORKS. Three passes.
//   1. UNIVERSE.  Every .js/.mjs and .html under the repo root, minus an exclude
//      list. argv files are added even if excluded, so the caller always gets what
//      it asked for. Files outside argv are read only to resolve the graph.
//   2. ENTRIES.   A file is an iframe entry if a framed HTML document loads it, or
//      if it identifies itself as frame code. A file is a worker entry if something
//      constructs a Worker/SharedWorker/ServiceWorker from it, or if it identifies
//      itself as worker code by using worker-scope globals. Self-identification
//      matters: a worker script nothing statically references is still a worker.
//   3. REACH.     Breadth-first over static import / export-from / dynamic import()
//      edges from every entry. A registerTool call site anywhere in the reachable
//      set is a finding, reported with the entry that reaches it.
//
// COMMENTS, STRINGS AND REGEX LITERALS ARE BLANKED before matching, line numbers
// preserved. A file that merely writes the word registerTool in prose — this file,
// for one — is not a call site. Regex literals matter as much as strings here: a
// pattern containing a quote character will desynchronise a naive scanner for the
// rest of the file, and this file is full of such patterns. See blank().
//
// VACUITY. The failure this checker exists to prevent is a green light over nothing
// scanned, so it prints its own coverage and refuses to report success when it
// examined no JavaScript at all. `--selftest` runs it against fixtures that DO
// contain violations, which is the only way to know a zero is a real zero.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";

const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".claude", "dist", "build", "coverage", ".worktrees"]);
const CODE = /\.(m?js|cjs)$/;
const HTML = /\.html?$/;

// ── repo root: the nearest ancestor holding a package.json ────────────────────
function repoRoot(from = process.cwd()) {
  let d = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(d, "package.json"))) return d;
    const up = path.dirname(d);
    if (up === d) return path.resolve(from);
    d = up;
  }
}

function walk(root, out = []) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) walk(p, out);
    } else if (e.isFile() && (CODE.test(e.name) || HTML.test(e.name))) {
      out.push(p);
    }
  }
  return out;
}

const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };

// ── blank comments, string bodies and regex literals ──────────────────────────
// Offsets and newlines are preserved, so a line number computed on the blanked copy
// is the line number in the real file.
//
// Regex literals MUST be blanked, not merely skipped. This very file holds patterns
// like /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi — a naive scanner sees the
// double quote inside the pattern, enters string mode, and desynchronises for the
// rest of the file. That is not hypothetical: it made the checker report three
// call sites inside its own --selftest fixtures on the first real run.
//
// Telling a regex literal from a division needs the previous significant token. The
// standard heuristic: `/` opens a regex when the last non-blank character before it
// is an operator, an opening bracket, or the end of a keyword that can precede an
// expression. Anything else is division.
const RE_OK_BEFORE = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "^", "<", ">", "~", "\n"]);
const RE_OK_KEYWORDS = /\b(return|typeof|instanceof|in|of|new|delete|void|do|else|case|yield|await)$/;

function blank(src) {
  const out = Array.from(src);
  const hide = (i) => { if (out[i] !== "\n") out[i] = " "; };
  const n = src.length;
  let i = 0;
  let prev = ""; // last significant (non-blank, non-comment) character emitted
  let prevRun = ""; // trailing identifier characters, for the keyword test

  while (i < n) {
    const c = src[i], d = src[i + 1];

    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") hide(i++); continue; }
    if (c === "/" && d === "*") {
      hide(i++); hide(i++);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) hide(i++);
      if (i < n) { hide(i++); hide(i++); }
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++; // the opening quote stays, so `new Worker("x")` keeps its shape
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { hide(i++); if (i < n) hide(i++); continue; }
        hide(i++);
      }
      i++;
      prev = q; prevRun = "";
      continue;
    }

    if (c === "/" && (RE_OK_BEFORE.has(prev) || RE_OK_KEYWORDS.test(prevRun))) {
      // regex literal: consume to the closing slash, honouring [...] and escapes
      i++;
      let inClass = false;
      while (i < n && src[i] !== "\n") {
        const ch = src[i];
        if (ch === "\\") { hide(i++); if (i < n) hide(i++); continue; }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) break;
        hide(i++);
      }
      if (i < n && src[i] === "/") i++; // closing slash
      while (i < n && /[a-z]/.test(src[i])) i++; // flags
      prev = "/"; prevRun = "";
      continue;
    }

    if (!/\s/.test(c)) {
      prev = c;
      prevRun = /[A-Za-z0-9_$]/.test(c) ? prevRun + c : "";
    } else if (c === "\n") {
      prev = "\n"; prevRun = "";
    }
    i++;
  }
  return out.join("");
}

// String literals survive blanking as empty quotes, so specifiers are read from the
// RAW source with a matching pattern, not from the blanked copy.
function specifiers(raw) {
  const found = new Set();
  const pats = [
    /\bimport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const p of pats) for (const m of raw.matchAll(p)) found.add(m[1]);
  return [...found];
}

function resolveSpec(spec, fromFile) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null; // bare = package
  const base = spec.startsWith("/") ? spec : path.resolve(path.dirname(fromFile), spec);
  const tries = [base, base + ".js", base + ".mjs", path.join(base, "index.js"), path.join(base, "index.mjs")];
  for (const t of tries) { try { if (fs.statSync(t).isFile()) return t; } catch { /* next */ } }
  return null;
}

// ── the two things we are looking for ─────────────────────────────────────────
function registerSites(raw, file) {
  const src = blank(raw);
  const sites = [];
  for (const m of src.matchAll(/\bregisterTool\s*\(/g)) {
    sites.push({ file, line: src.slice(0, m.index).split("\n").length });
  }
  return sites;
}

const WORKER_SELF = [
  /\bimportScripts\s*\(/,
  /\bself\s*\.\s*onmessage\b/,
  /\bself\s*\.\s*postMessage\s*\(/,
  /\bself\s*\.\s*addEventListener\s*\(/,
  /\bDedicatedWorkerGlobalScope\b/,
  /\bWorkerGlobalScope\b/,
];
const FRAME_SELF = [
  /\bwindow\s*\.\s*parent\s*!==?\s*window\b/,
  /\bwindow\s*\.\s*top\s*!==?\s*window\b/,
  /\bparent\s*\.\s*postMessage\s*\(/,
  /\bwindow\s*\.\s*frameElement\b/,
];

function workerConstructions(raw, fromFile) {
  const out = [];
  const pats = [
    /new\s+(?:Worker|SharedWorker)\s*\(\s*['"]([^'"]+)['"]/g,
    /new\s+(?:Worker|SharedWorker)\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/g,
    /serviceWorker\s*\.\s*register\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const p of pats) for (const m of raw.matchAll(p)) {
    const r = resolveSpec(m[1].startsWith(".") || m[1].startsWith("/") ? m[1] : "./" + m[1], fromFile);
    if (r) out.push(r);
  }
  return out;
}

// HTML: which documents are loaded into a frame, and which scripts each doc loads.
function htmlFacts(raw, file) {
  const framedDocs = [];
  for (const m of raw.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const r = resolveHtml(m[1], file);
    if (r) framedDocs.push(r);
  }
  const scripts = [];
  for (const m of raw.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const r = resolveSpec(m[1].startsWith(".") || m[1].startsWith("/") ? m[1] : "./" + m[1], file);
    if (r) scripts.push(r);
  }
  // inline <script> bodies, so a registerTool typed straight into a framed document
  // is still a call site and still gets a line number in the HTML file.
  const inlineHasRegister = /<script\b[^>]*>[\s\S]*?\bregisterTool\s*\([\s\S]*?<\/script>/i.test(raw);
  const srcdocFramed = /<iframe\b[^>]*\bsrcdoc\s*=/i.test(raw);
  return { framedDocs, scripts, inlineHasRegister, srcdocFramed };
}

function resolveHtml(spec, fromFile) {
  if (/^[a-z]+:/i.test(spec)) return null; // absolute URL, not a file in this tree
  const base = spec.startsWith("/") ? spec.slice(1) : path.resolve(path.dirname(fromFile), spec.split("?")[0].split("#")[0]);
  try { if (fs.statSync(base).isFile()) return base; } catch { /* not local */ }
  return null;
}

// ── the analysis ──────────────────────────────────────────────────────────────
export function analyse({ root, argvFiles = [] }) {
  const all = walk(root);
  for (const f of argvFiles) if (!all.includes(f)) all.push(f);

  const code = all.filter((f) => CODE.test(f));
  const html = all.filter((f) => HTML.test(f));
  const raws = new Map();
  for (const f of [...code, ...html]) raws.set(f, read(f));

  // sites
  const sites = [];
  for (const f of code) sites.push(...registerSites(raws.get(f), f));

  // graph
  const imports = new Map();
  for (const f of code) {
    const edges = [];
    for (const s of specifiers(raws.get(f))) {
      const r = resolveSpec(s, f);
      if (r && CODE.test(r)) edges.push(r);
    }
    imports.set(f, edges);
  }

  // entries
  const entries = new Map(); // file -> reason
  const note = (f, why) => { if (f && CODE.test(f) && !entries.has(f)) entries.set(f, why); };

  const framed = new Set();
  for (const h of html) {
    const facts = htmlFacts(raws.get(h), h);
    for (const d of facts.framedDocs) framed.add(d);
  }
  for (const h of html) {
    const facts = htmlFacts(raws.get(h), h);
    if (framed.has(h)) for (const s of facts.scripts) note(s, `loaded by framed document ${path.relative(root, h)}`);
    for (const w of workerConstructions(raws.get(h), h)) note(w, `constructed as a worker by ${path.relative(root, h)}`);
  }
  for (const f of code) {
    const raw = raws.get(f);
    for (const w of workerConstructions(raw, f)) note(w, `constructed as a worker by ${path.relative(root, f)}`);
    const b = blank(raw);
    if (WORKER_SELF.some((p) => p.test(b))) note(f, "uses worker-scope globals (self-identifying worker)");
    if (FRAME_SELF.some((p) => p.test(b))) note(f, "uses frame-scope globals (self-identifying frame script)");
  }

  // reachability
  const findings = [];
  const siteIndex = new Map();
  for (const s of sites) { if (!siteIndex.has(s.file)) siteIndex.set(s.file, []); siteIndex.get(s.file).push(s.line); }

  for (const [entry, why] of entries) {
    const seen = new Set([entry]);
    const queue = [entry];
    while (queue.length) {
      const f = queue.shift();
      for (const line of siteIndex.get(f) ?? [])
        findings.push({ file: f, line, entry, why });
      for (const nxt of imports.get(f) ?? []) if (!seen.has(nxt)) { seen.add(nxt); queue.push(nxt); }
    }
  }

  // a framed HTML document with registerTool typed inline is a finding of its own
  for (const h of html) {
    if (!framed.has(h)) continue;
    if (htmlFacts(raws.get(h), h).inlineHasRegister)
      findings.push({ file: h, line: 0, entry: h, why: "inline <script> in a framed document" });
  }

  return { root, code, html, sites, entries, findings, framed };
}

// ── reporting ─────────────────────────────────────────────────────────────────
function report(a, argvCount, log = console.log) {
  const rel = (f) => path.relative(a.root, f) || f;
  log("check-toplevel: registration must live in the top-level document only");
  log(`  root                       ${a.root}`);
  log(`  argv files                 ${argvCount}`);
  log(`  js/mjs scanned             ${a.code.length}`);
  log(`  html scanned               ${a.html.length}`);
  log(`  framed documents           ${a.framed.size}`);
  log(`  iframe/worker entry files  ${a.entries.size}`);
  for (const [f, why] of a.entries) log(`    - ${rel(f)}  (${why})`);
  log(`  registerTool call sites    ${a.sites.length}`);
  for (const s of a.sites) log(`    - ${rel(s.file)}:${s.line}`);

  if (a.code.length === 0) {
    log("\nFAIL: scanned no JavaScript at all. Refusing to report a pass over an empty scan.");
    return 1;
  }
  if (a.findings.length === 0) {
    log(`\nOK: 0 of ${a.sites.length} registerTool call site(s) are reachable from an iframe or worker entry.`);
    return 0;
  }
  log(`\nFAIL: ${a.findings.length} registerTool call site(s) reachable from an iframe or worker entry:`);
  for (const f of a.findings)
    log(`  ${rel(f.file)}:${f.line}  reachable from ${rel(f.entry)} — ${f.why}`);
  log("\nMove the registration into the top-level document. A tool registered inside a");
  log("frame or a worker is never discovered, so this does not degrade — it disappears.");
  return 1;
}

// ── selftest: prove a zero is a real zero ─────────────────────────────────────
function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-toplevel-"));
  const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
  w("package.json", "{}\n");

  // clean: top-level document registers, via a module it imports
  w("index.html", '<script type="module" src="./boot.js"></script>\n<iframe src="./frame.html"></iframe>\n');
  w("boot.js", 'import { defs } from "./defs.js";\ndocument.modelContext.registerTool(defs[0], { signal });\n');
  w("defs.js", "export const defs = [];\n");

  // violation 1: a script loaded by a framed document, one import hop away
  w("frame.html", '<script type="module" src="./frame-boot.js"></script>\n');
  w("frame-boot.js", 'import "./frame-reg.js";\n');
  w("frame-reg.js", "document.modelContext.registerTool({}, {});\n");

  // violation 2: a worker, self-identifying, nothing statically constructs it
  w("wk.js", "self.onmessage = () => {};\ndocument.modelContext.registerTool({}, {});\n");

  // decoy: prose and a string mentioning the name are not call sites
  w("prose.js", '// registerTool( in a comment\nconst s = "registerTool(";\nexport default s;\n');

  // decoy: a regex literal holding a quote character used to desynchronise the
  // blanker for the whole rest of the file, which then read the fixture strings
  // below it as live code. Both names here are inert; neither may be reported.
  w("regexy.js", 'const p = /src\\s*=\\s*["\']([^"\']+)["\']/g;\nconst q = "self.onmessage";\nconst r = "registerTool(";\nexport default [p, q, r];\n');

  const a = analyse({ root: dir, argvFiles: [] });
  const rel = (f) => path.relative(dir, f);
  const flagged = new Set(a.findings.map((f) => rel(f.file)));
  const siteFiles = new Set(a.sites.map((s) => rel(s.file)));

  const checks = [
    ["prose.js is NOT a call site (comments and strings blanked)", !siteFiles.has("prose.js")],
    ["boot.js IS a call site", siteFiles.has("boot.js")],
    ["frame-reg.js flagged (reached from a framed document, one hop)", flagged.has("frame-reg.js")],
    ["wk.js flagged (self-identifying worker)", flagged.has("wk.js")],
    ["boot.js NOT flagged (top-level document is the correct place)", !flagged.has("boot.js")],
    ["regexy.js is NOT a call site (a quote inside a regex must not desync the blanker)", !siteFiles.has("regexy.js")],
    ["regexy.js is NOT read as a worker entry", ![...a.entries.keys()].map(rel).includes("regexy.js")],
    ["finds exactly 2 violations", a.findings.length === 2],
    ["empty scan is a FAIL, not a pass", report(analyse({ root: fs.mkdtempSync(path.join(os.tmpdir(), "empty-")), argvFiles: [] }), 0, () => {}) === 1],
  ];
  let bad = 0;
  console.log("check-toplevel --selftest");
  for (const [name, pass] of checks) { if (!pass) bad++; console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}`); }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(bad ? `\nSELFTEST FAILED (${bad})` : "\nSELFTEST OK — the checker detects the violations it claims to detect.");
  return bad ? 1 : 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes("--selftest")) {
  process.exit(selftest());
} else {
  const files = argv.filter((a) => !a.startsWith("--")).map((f) => path.resolve(f));
  const root = repoRoot(files[0] ? path.dirname(files[0]) : process.cwd());
  process.exit(report(analyse({ root, argvFiles: files }), files.length));
}
