"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function extension({ helperVersion = "1.1.5", duplicate = false } = {}) {
  const calls = [];
  const saved = { yourlsUrl: "https://sho.rt/admin/", apiSignature: "test-token", autoCopy: true };
  let messageListener;
  const browser = {
    i18n: { getMessage: () => "" },
    storage: { local: {
      get: async () => ({ ...saved }),
      set: async values => { Object.assign(saved, values); },
      remove: async key => { delete saved[key]; }
    }},
    permissions: { contains: async () => true },
    menus: {
      create: () => {}, update: async () => {}, refresh: async () => {},
      onShown: { addListener: () => {} }, onClicked: { addListener: () => {} }
    },
    notifications: { create: async () => 1 },
    runtime: { onMessage: { addListener: fn => { messageListener = fn; } } },
    tabs: { get: async () => ({ type: "messageCompose" }) },
    scripting: { executeScript: async () => [{ result: true }] },
    compose: { addAttachment: async () => {} }
  };
  const fakeFetch = async (url, opts) => {
    const data = new URLSearchParams(opts.body);
    const action = data.get("action");
    calls.push({ url, action, opts, token: data.get("signature") });
    let result = { status: "success", statusCode: 200 };
    if (action === "db-stats") result = { ...result, total_links: "12", total_clicks: "45" };
    if (action === "version") result = { ...result, version: "2.1" };
    if (action === "stats") result = { ...result, links: {} };
    if (action === "shorturl") result = duplicate
      ? { status: "fail", code: "error:url", message: "already exists", shorturl: "https://sho.rt/AbC" }
      : { ...result, shorturl: "https://sho.rt/AbC" };
    if (action === "kurl_find_by_url") result = {
      ...result, shorturl: "https://sho.rt/AbC",
      keyword: "AbC", longurl: data.get("url"), title: "A test link"
    };
    if (action === "kurl_regenerate") result = {
      ...result, shorturl: "https://sho.rt/" + (data.get("keyword") || "XYZ"),
      keyword: data.get("keyword") || "XYZ"
    };
    if (action === "expand") result = { ...result, longurl: "https://example.org/" };
    if (action === "kurl_ping") result = {
      ...result, kurl_extended: true, kurl_helper_version: helperVersion,
      kurl_capabilities: ["delete", "find_by_url", "regenerate"]
    };
    if (action === "url-stats") result = {
      ...result, link: { shorturl: "https://sho.rt/AbC", url: "https://example.org/", clicks: 3 }
    };
    const status = action === "shorturl" && duplicate ? 400 : 200;
    return {
      status, ok: status < 300, headers: { get: () => null },
      body: null, text: async () => JSON.stringify(result)
    };
  };
  const context = vm.createContext({
    window: {}, browser, fetch: fakeFetch, navigator: { clipboard: { writeText: async () => {} } },
    URL, URLSearchParams, AbortController, TextDecoder, Uint8Array,
    File: global.File, atob: global.atob, console, setTimeout, clearTimeout
  });
  vm.runInContext(read("JS/helpers.js"), context, { filename: "JS/helpers.js" });
  vm.runInContext(read("JS/background.js"), context, { filename: "JS/background.js" });
  return { helpers: context.window.Helpers, invoke: m => messageListener(m), calls };
}

test("validates the configured endpoint, URLs and case-sensitive keywords", () => {
  const { helpers: h } = extension();
  assert.equal(h.sanitizeBaseUrl("https://sho.rt/admin/"), "https://sho.rt");
  assert.equal(h.sanitizeBaseUrl("https://sho.rt/yourls-api.php"), "https://sho.rt");
  assert.equal(h.sanitizeBaseUrl("https://sho.rt/?signature=secret"), "");
  assert.equal(h.validHttpUrl("javascript:alert(1)"), "");
  assert.equal(h.validHttpUrl("https://user:password@example.org/"), "");
  assert.equal(h.extractKeyword("https://sho.rt", "https://evil.org/AbC"), "");
  assert.equal(h.extractKeyword("https://sho.rt", "https://sho.rt/AbC"), "AbC");
  assert.equal(h.extractKeyword("https://sho.rt", "https://sho.rt/%2Ffoo"), "");
});
test("shortens, accepts existing URLs under HTTP 400, and blocks foreign URLs", async () => {
  const a = extension();
  const made = await a.invoke({ type: "SHORTEN_URL", longUrl: "https://example.org/", keyword: "AbC" });
  assert.equal(made.shortUrl, "https://sho.rt/AbC");
  assert.equal(a.calls[0].url, "https://sho.rt/yourls-api.php");
  assert.equal(a.calls[0].opts.redirect, "error");
  assert.equal(a.calls[0].opts.credentials, "omit");
  const b = extension({ duplicate: true });
  const existing = await b.invoke({ type: "SHORTEN_URL", longUrl: "https://example.org/" });
  assert.equal(existing.ok, true);
  assert.equal(existing.already, true);
  const foreign = await a.invoke({ type: "GET_STATS", shortUrl: "https://evil.org/AbC" });
  assert.equal(foreign.ok, false);
});
test("tests unsaved settings without replacing saved credentials", async () => {
  const a = extension();
  const result = await a.invoke({ type: "CHECK_CONNECTION", settings: {
    yourlsUrl: "https://new.example", apiSignature: "new-token"
  }});
  assert.equal(result.ok, true);
  assert.equal(a.calls[0].url, "https://new.example/yourls-api.php");
  assert.equal(a.calls[0].token, "new-token");
});
test("reports dashboard totals and gates deletion on current helper version", async () => {
  const a = extension();
  const info = await a.invoke({ type: "GET_INFO" });
  assert.equal(info.ok, true);
  assert.equal(info.data.totalLinks, 12);
  assert.equal(info.data.totalClicks, 45);
  assert.equal(info.data.helperReady, true);
  const b = extension({ helperVersion: "1.1.0" });
  const failed = await b.invoke({ type: "DELETE_SHORTURL", shortUrl: "https://sho.rt/AbC" });
  assert.equal(failed.ok, false);
  assert.equal(b.calls.some(item => item.action === "kurl_delete"), false);
});
test("lookup, expand, and safe update use WordPress helper API actions", async () => {
  const a = extension();
  const lookup = await a.invoke({ type: "LOOKUP_URL", longUrl: "https://example.org/" });
  assert.equal(lookup.ok, true);
  assert.equal(lookup.data.shortUrl, "https://sho.rt/AbC");
  assert.equal(lookup.data.keyword, "AbC");
  assert.equal(a.calls.some(r => r.action === "kurl_find_by_url"), true);
  const expand = await a.invoke({ type: "EXPAND_URL", shortUrl: "https://sho.rt/AbC" });
  assert.equal(expand.data.target, "https://example.org/");
  const changed = await a.invoke({
    type: "UPDATE_URL", longUrl: "https://example.org/", shortUrl: "https://sho.rt/AbC"
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.shortUrl, "https://sho.rt/AbC");
  const newSlug = await a.invoke({
    type: "REGENERATE_URL", longUrl: "https://example.org/",
    shortUrl: "https://sho.rt/AbC", keyword: ""
  });
  assert.equal(newSlug.shortUrl, "https://sho.rt/XYZ");
  assert.equal(a.calls.some(r => r.action === "kurl_regenerate"), true);
});
test("helper-gated editing never calls regeneration on stale helper", async () => {
  const a = extension({ helperVersion: "1.0.0" });
  const edited = await a.invoke({
    type: "UPDATE_URL", longUrl: "https://example.org/", shortUrl: "https://sho.rt/AbC"
  });
  assert.equal(edited.ok, false);
  assert.equal(a.calls.some(r => r.action === "kurl_regenerate"), false);
});
test("bounded local activity log hides targets and tokens", async () => {
  const a = extension();
  await a.invoke({ type: "SHORTEN_URL", longUrl: "https://example.org/private?id=2" });
  const data = await a.invoke({ type: "GET_LOG" });
  assert.equal(data.ok, true);
  assert.equal(data.data.length, 1);
  assert.equal(data.data[0].action, "SHORTEN_URL");
  assert.equal(JSON.stringify(data.data).includes("example.org"), false);
  assert.equal(JSON.stringify(data.data).includes("test-token"), false);
  await a.invoke({ type: "CLEAR_LOG" });
  assert.equal((await a.invoke({ type: "GET_LOG" })).data.length, 0);
});
test("dashboard does not interpolate remote response fields into markup", () => {
  const js = read("JS/dashboard.js");
  assert.equal(/\.innerHTML\s*=/.test(js), false);
  assert.equal(js.includes("textContent"), true);
  for (const file of ["bulk.html", "logs.html", "JS/bulk.js", "JS/logs.js"]) {
    assert.equal(fs.existsSync(path.join(root, file)), true);
  }
});
test("manifest and locales contain parseable JSON", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  for (const dir of fs.readdirSync(path.join(root, "_locales"))) {
    assert.doesNotThrow(() => JSON.parse(read("_locales/" + dir + "/messages.json")));
  }
});
test("every JS-referenced DOM element exists in the matching page", () => {
  for (const [html, js] of [
    ["dashboard.html", "JS/dashboard.js"],
    ["popup.html", "JS/popup.js"],
    ["options.html", "JS/options.js"],
    ["bulk.html", "JS/bulk.js"],
    ["logs.html", "JS/logs.js"]
  ]) {
    const markup = read(html);
    const script = read(js);
    const defined = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    const used = [...script.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]);
    for (const id of used) assert.ok(defined.has(id), js + " references missing #" + id);
  }
});
