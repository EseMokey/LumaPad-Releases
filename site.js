/* Lumapad download pages: everything comes live from the public releases repository's GitHub releases. */
"use strict";
const DEFAULT_REPO = "EseMokey/LumaPad-Releases";
const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v != null && v !== false) e.setAttribute(k, v === true ? "" : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};

async function siteConfig() {
  try { const r = await fetch("site-config.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch { }
  try { const r = await fetch("../site-config.json", { cache: "no-store" }); if (r.ok) return await r.json(); } catch { }
  return {};
}

function verOf(tag) { const m = String(tag || "").match(/(\d+(?:\.\d+){1,3})(-[0-9A-Za-z.-]+)?/); return m ? m[1] + (m[2] || "") : null; }
function cmp(a, b) {
  const p = s => { const [core, pre] = s.split(/-(.*)/s); const n = core.split(".").map(Number); while (n.length < 4) n.push(0); return [n, pre ? pre.split(".") : []]; };
  const [an, ap] = p(a), [bn, bp] = p(b);
  for (let i = 0; i < 4; i++) if (an[i] !== bn[i]) return an[i] - bn[i];
  if (!ap.length || !bp.length) return (ap.length ? 0 : 1) - (bp.length ? 0 : 1);
  for (let i = 0; i < Math.min(ap.length, bp.length); i++) {
    const x = +ap[i], y = +bp[i], nx = !isNaN(x), ny = !isNaN(y);
    const c = nx && ny ? x - y : nx ? -1 : ny ? 1 : ap[i].localeCompare(bp[i]);
    if (c) return c;
  }
  return ap.length - bp.length;
}

async function releases(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=40`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(r.status === 403 ? "GitHub is busy right now; try again in a minute." : r.status === 404 ? "No releases yet." : "GitHub said " + r.status);
  const list = (await r.json()).filter(x => !x.draft).map(x => {
    const v = verOf(x.tag_name);
    const setup = (x.assets || []).find(a => /^Lumapad-Setup.*\.exe$/i.test(a.name));
    return v && { version: v, tag: x.tag_name, beta: x.prerelease || v.includes("-"), date: (x.published_at || "").slice(0, 10), notes: x.body || "", page: x.html_url, setup: setup && setup.browser_download_url, size: setup ? setup.size : 0, downloads: setup ? setup.download_count : 0 };
  }).filter(Boolean);
  list.sort((a, b) => cmp(b.version, a.version));
  return list;
}

// release notes: a small, safe Markdown subset as text nodes (never HTML from the notes)
function notes(md) {
  const wrap = h("div", { class: "notes" });
  let list = null;
  const inline = t => t.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map(p => /^\*\*.+\*\*$/.test(p) ? h("b", {}, p.slice(2, -2)) : /^`.+`$/.test(p) ? h("code", {}, p.slice(1, -1)) : p);
  for (const raw of String(md).replace(/^\s*sha256:.*$/gim, "").split(/\r?\n/)) {
    const line = raw.trimEnd(); let m;
    if (!line.trim() || /^-{3,}$/.test(line.trim())) { list = null; continue; }
    if ((m = line.match(/^#{1,4}\s+(.*)/))) { list = null; wrap.append(h("h4", {}, inline(m[1]))); }
    else if ((m = line.match(/^>\s?(.*)/))) { list = null; wrap.append(h("blockquote", {}, inline(m[1]))); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (!list) { list = h("ul"); wrap.append(list); } list.append(h("li", {}, inline(m[1]))); }
    else { list = null; wrap.append(h("p", {}, inline(line))); }
  }
  return wrap;
}

const mb = n => n ? (n / 1048576).toFixed(0) + " MB" : "";
function releaseCard(r, open, latestStable) {
  return h("details", { class: "release", open: open || null },
    h("summary", {},
      h("div", { class: "rname" }, "Lumapad " + r.version, r.beta ? h("span", { class: "tag beta" }, "Beta") : h("span", { class: "tag full" }, "Full release"), latestStable && r.version === latestStable ? h("span", { class: "tag latest" }, "Latest") : null),
      h("span", { class: "meta" }, [r.date, mb(r.size)].filter(Boolean).join(" · "))),
    h("div", { class: "rbody" }, notes(r.notes),
      h("p", {}, r.setup ? h("a", { class: "btn ghost", href: r.setup }, "Download " + r.version) : null, " ", h("a", { href: r.page }, "Release page"))));
}

// ---------------------------------------------------------------- the public page
async function publicPage() {
  const cfg = await siteConfig(), repo = cfg.repo || DEFAULT_REPO;
  const dl = $("#download"), meta = $("#dlMeta"), list = $("#releases");
  try {
    const all = await releases(repo);
    const full = all.filter(r => !r.beta && r.setup);
    const latest = full[0];
    if (!latest) { dl.textContent = "Coming soon"; dl.setAttribute("aria-disabled", "true"); meta.textContent = "The first release is on its way."; list.replaceChildren(h("p", { class: "loading" }, "No releases yet.")); return; }
    dl.href = latest.setup; dl.textContent = `Download Lumapad ${latest.version}`;
    meta.textContent = `For Windows 10 and 11 (64-bit) · ${mb(latest.size)} · released ${latest.date}`;
    list.replaceChildren(...full.slice(0, 8).map((r, i) => releaseCard(r, i === 0, latest.version)));
  } catch (e) {
    dl.href = `https://github.com/${repo}/releases`; dl.textContent = "Download from GitHub";
    meta.textContent = e.message;
    list.replaceChildren(h("p", { class: "loading" }, "Couldn't load the list: ", h("a", { href: `https://github.com/${repo}/releases` }, "see every release on GitHub"), "."));
  }
  for (const a of document.querySelectorAll("[data-issues]")) a.href = `https://github.com/${repo}/issues/new/choose`;
}

// ---------------------------------------------------------------- the tester page
async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim().toLowerCase()));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function testerPage() {
  const cfg = await siteConfig(), repo = cfg.repo || DEFAULT_REPO;
  const want = (cfg.testerHash || "") || await sha256("lumapad-tester");
  const gate = $("#gate"), box = $("#betas"), input = $("#code"), err = $("#err");
  const unlock = async () => {
    gate.hidden = true; box.hidden = false;
    const list = $("#betaList");
    try {
      const all = await releases(repo);
      const latestFull = (all.find(r => !r.beta) || {}).version;
      const newestBeta = all.find(r => r.beta && r.setup);
      $("#betaDl").replaceChildren(newestBeta ? h("a", { class: "btn primary", href: newestBeta.setup }, `Download beta ${newestBeta.version}`) : h("p", { class: "meta" }, "No beta right now: the full release is the newest."));
      list.replaceChildren(...(all.length ? all.slice(0, 30).map((r, i) => releaseCard(r, i === 0, latestFull)) : [h("p", { class: "loading" }, "No versions yet.")]));
    } catch (e) { list.replaceChildren(h("p", { class: "loading" }, e.message + " ", h("a", { href: `https://github.com/${repo}/releases` }, "Every release on GitHub"))); }
    for (const a of document.querySelectorAll("[data-issues]")) a.href = `https://github.com/${repo}/issues/new/choose`;
  };
  try { if (localStorage.getItem("lumapad.tester") === want) return unlock(); } catch { }
  const tryCode = async () => {
    const got = await sha256(input.value);
    if (got === want) { try { localStorage.setItem("lumapad.tester", want); } catch { } unlock(); }
    else { err.textContent = "That code isn't right."; input.select(); }
  };
  $("#go").addEventListener("click", tryCode);
  input.addEventListener("keydown", e => { if (e.key === "Enter") tryCode(); });
  input.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  $("#year") && ($("#year").textContent = new Date().getFullYear());
  if (document.body.dataset.page === "tester") testerPage(); else publicPage();
});
