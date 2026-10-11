"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"dashboard.html"),"utf8");
const js=fs.readFileSync(path.join(root,"JS/dashboard.js"),"utf8");
const m=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
assert.equal(m.version,"2.0.21");assert.equal(m.browser_specific_settings.gecko.id,"yourls@drissner.me");
assert.match(html,/<footer class="kurl-dashboard-footer"/);
assert.match(html,/id="kurl-dashboard-version"/);
assert.match(js,/browser\.runtime\.getManifest\(\)\.version/);
for(const [url,key] of [["https://drissner.media/kontakt","footerContact"],["https://www.paypal.com/paypalme/drissner","footerSupport"]]) {
 const a=html.match(new RegExp('<a href="'+url+'"[^>]*>'));
 assert(a);assert(a[0].includes('target="_blank"'));assert(a[0].includes('rel="noopener noreferrer"'));assert(a[0].includes('data-i18n-key="'+key+'"'));
}
for(const lang of fs.readdirSync(path.join(root,"_locales"))){
 const data=JSON.parse(fs.readFileSync(path.join(root,"_locales",lang,"messages.json"),"utf8"));
 for(const key of ["footerContact","footerSupport"])assert(data[key]?.message, lang+': '+key);
}
console.log('PASS: localized Thunderbird footer, dynamic version, unchanged extension ID');
