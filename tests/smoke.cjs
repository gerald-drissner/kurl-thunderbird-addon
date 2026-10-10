const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
function source(p){return fs.readFileSync(path.join(root,p),'utf8')}
function newContext(opts={}){
 const storage={yourlsUrl:'https://sho.rt/admin',apiSignature:'private-abc',autoCopy:true,showCopyNotifications:opts.showCopyNotifications!==false};
 const calls=[], menus=[];
 let messageHandler,onInstalledHandler,contextClickHandler;
 const sentNotifications=[], clipboardWrites=[];
 const api={i18n:{getMessage:()=>''},permissions:{contains:async()=>true},
  storage:{local:{get:async arg=>typeof arg==='string'?{[arg]:storage[arg]}:Object.assign({},arg,storage),set:async o=>Object.assign(storage,o),remove:async k=>delete storage[k]}},
  runtime:{getURL:path=>"moz-extension://test/"+path,onMessage:{addListener(fn){messageHandler=fn}},onInstalled:{addListener(fn){onInstalledHandler=fn}}},
  menus:{create:details=>{
    if (menus.some(x=>x.id===details.id)) throw new Error('Duplicate menu');
    menus.push(details);
  },remove:async id=>{const i=menus.findIndex(x=>x.id===id);if(i<0)throw Error('Not found');menus.splice(i,1);},
  removeAll:async()=>{menus.length=0},onShown:{addListener(){}},onClicked:{addListener(fn){contextClickHandler=fn}},update:async()=>{},refresh:async()=>{}},
  notifications:{create:async obj=>sentNotifications.push(obj)},tabs:{get:async()=>({type:'messageCompose'})},compose:{getComposeDetails:async()=>({isPlainText:false}),addAttachment:async()=>{}},
  scripting:{executeScript:async()=>[{result:false}]}
 };
 let errorMessage=null;
 const fetch=async (url, request)=>{
  assert.ok(url.startsWith('https://'));
  assert.equal(request.redirect,'error'); assert.equal(request.credentials,'omit');
  const body=request.body;const action=body.get('action');
  calls.push({url,request,action,body});
  assert.equal(body.get('hash'),'sha256');
  assert.notEqual(body.get('signature'),storage.apiSignature);
  assert.equal(body.get('signature').length,64);
  const expected={status:'success',statusCode:200};
  if(action==='shorturl')Object.assign(expected,{shorturl:'https://sho.rt/AbC'});
  if(action==='kurl_ping')Object.assign(expected,{kurl_extended:1,kurl_helper_version: opts.helperVersion||'1.1.6',kurl_capabilities:['delete','find_by_url','regenerate']});
  if(action==='kurl_find_by_url')Object.assign(expected,{shorturl:'https://sho.rt/AbC',longurl:body.get('url')});
  if(action==='kurl_regenerate')Object.assign(expected,{shorturl:'https://sho.rt/AbC'});
  if(action==='db-stats')Object.assign(expected,{total_links:12,total_clicks:24});
  if(action==='version')Object.assign(expected,{version:'1.10'});
  if(opts.errorMessage && action==='shorturl'){expected.status='fail';expected.statusCode=400;expected.message=opts.errorMessage;}
  if(opts.apiFailure && (action === (opts.apiFailure.action || 'db-stats'))) {
    const simulated=opts.apiFailure;
    const txt=simulated.html || JSON.stringify({
      status:simulated.statusText || 'fail',
      errorCode:simulated.errorCode ?? String(simulated.status || 403),
      message:simulated.message || ''
    });
    return {ok:false,status:simulated.status || 403,headers:{get:()=>String(txt.length)},
      body:null,text:async()=>txt};
  }
  const text=JSON.stringify(expected);
  return {ok:expected.status!=='fail',status:expected.status==='fail'?400:200,
    headers:{get:()=>String(text.length)},body:null,text:async()=>text};
 };
 const ctx={window:{},browser:api,URL,URLSearchParams,crypto:webcrypto,fetch,navigator:{clipboard:{writeText:async value=>clipboardWrites.push(value)}},
 TextEncoder,TextDecoder,AbortController,setTimeout,clearTimeout,Date,Uint8Array,console};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(source('JS/helpers.js'),ctx,{filename:'helpers.js'});
 vm.runInContext(source('JS/background.js'),ctx,{filename:'background.js'});
 return {ctx,calls,storage,menus,sentNotifications,clipboardWrites,send:async msg=>messageHandler(msg),install:()=>onInstalledHandler(),click:async(info,tab)=>contextClickHandler(info,tab)};
}
test('https-only server, preserve long URLs exactly, validate unsafe targets',async()=>{
 const x=newContext();
 const H=x.ctx.Helpers;
 assert.equal(H.sanitizeBaseUrl('https://sho.rt/admin/'),'https://sho.rt');
 assert.equal(H.sanitizeBaseUrl('http://sho.rt'),'');
 assert.equal(H.validHttpUrl('https://example.com'),'https://example.com');
 assert.equal(H.validHttpUrl('https://example.com/ä?x=1'),'https://example.com/ä?x=1');
 assert.equal(H.validHttpUrl('file:///etc/hosts'),'');
 assert.equal(H.validHttpUrl('https://alice:pass@example.org'),'');
 const a=await x.send({type:'SHORTEN_URL',longUrl:'https://example.com/ä?x=1'});
 assert.equal(a.ok,true);assert.equal(a.shortUrl,'https://sho.rt/AbC');
 assert.equal(x.calls[0].body.get('url'),'https://example.com/ä?x=1');
});
test('YOURLS errors are informative',async()=>{
 const x=newContext({errorMessage:'Keyword already exists'});
 const r=await x.send({type:'SHORTEN_URL',longUrl:'https://example.org'});
 assert.equal(r.ok,false);assert.match(r.reason,/Keyword already exists/);
});
test('helper 1.1.6 accepted, helper ping cached',async()=>{
 const x=newContext();
 const info=await x.send({type:'GET_INFO'});
 assert.equal(info.ok,true);assert.equal(info.data.helperReady,true);
 const lookup=await x.send({type:'LOOKUP_URL',longUrl:'https://example.org'});
 assert.equal(lookup.data.shortUrl,'https://sho.rt/AbC');
 assert.equal(x.calls.filter(c=>c.action==='kurl_ping').length,1);
});
test('outdated helper denied mutation',async()=>{
 const x=newContext({helperVersion:'1.1.4'});
 const result=await x.send({type:'DELETE_SHORTURL',shortUrl:'https://sho.rt/AbC'});
 assert.equal(result.ok,false); assert.equal(x.calls.filter(c=>c.action==='kurl_delete').length,0);
});
test('right-click copy and compose menus register at background startup',async()=>{
 const x=newContext();await vm.runInContext('menuInitialization',x.ctx);
 assert.equal(x.menus.length,0);
 await x.install();await vm.runInContext('menuInitialization',x.ctx);
 assert.equal(x.menus.length,2);
 assert.equal(x.menus[0].id,'kurl-quick-copy');
 assert.ok(x.menus[0].contexts.includes('link'));
 assert.ok(x.menus[0].contexts.includes('selection'));
 assert.equal(x.menus[1].id,'kurl-quick-insert');
 assert.ok(x.menus[1].contexts.includes('compose_body'));
 assert.equal(x.menus[1].visible,true);
 await x.install();await vm.runInContext('menuInitialization',x.ctx);
 assert.equal(x.menus.length,2);
});
test('punctuation trimmed correctly',()=>{
 const x=newContext();
 assert.equal(vm.runInContext('extractFirstUrl("Siehe https://example.org/x.")',x.ctx),'https://example.org/x');
 assert.equal(vm.runInContext('extractFirstUrl("(Quelle: https://example.org/x)")',x.ctx),'https://example.org/x');
 assert.equal(vm.runInContext('extractFirstUrl("«https://example.org/x»")',x.ctx),'https://example.org/x');
 assert.equal(vm.runInContext('extractFirstUrl("https://example.org/wiki/Berlin_(Begriffsklärung)")',x.ctx),'https://example.org/wiki/Berlin_(Begriffsklärung)');
 assert.equal(vm.runInContext('extractFirstUrl("https://example.org/?q=[1]")',x.ctx),'https://example.org/?q=[1]');
});
test('bulk creates links sequentially and skips invalid lines',()=>{
 const js=source('JS/bulk.js');
 assert.doesNotMatch(js,/Promise\.all\(slice\.map/);
 assert.match(js,/item\.invalid/);
 assert.match(js,/LOG_BULK/);
});
test('package metadata and page references',()=>{
 const manifest=JSON.parse(source('manifest.json'));
 assert.equal(manifest.version,'2.0.14');
 assert.equal(manifest.browser_specific_settings.gecko.strict_min_version,'140.0');
 assert.deepEqual(manifest.optional_host_permissions,['https://*/*']);
 assert.ok(!manifest.permissions.includes('tabs'));
 for(const loc of fs.readdirSync(path.join(root,'_locales'))){
   const strings=JSON.parse(source('_locales/'+loc+'/messages.json'));
   assert.ok(strings.extensionName || JSON.parse(source('_locales/en/messages.json')).extensionName);
   assert.ok(strings.optionsPrivacyNotice || JSON.parse(source('_locales/en/messages.json')).optionsPrivacyNotice);
 }
 for(const [html,js] of [['dashboard.html','JS/dashboard.js'],['popup.html','JS/popup.js'],
 ['options.html','JS/options.js'],['bulk.html','JS/bulk.js'],['logs.html','JS/logs.js']]){
  const markup=source(html),script=source(js);
  const ids=new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  for(const [,id] of script.matchAll(/\$\("([^"]+)"\)/g)){
   assert.ok(ids.has(id),html+': missing #'+id);
  }
 }
 for(const size of [16,32,48,96])assert.ok(fs.existsSync(path.join(root,'images/kurl-icon-'+size+'.png')));
});

test('shortcut keys are optional, not invalid three-modifier bindings',()=>{
 const manifest=JSON.parse(source('manifest.json'));
 for(const config of Object.values(manifest.commands))
   assert.equal(config.suggested_key,undefined);
 for(const lang of ['en','de']) {
  const strings=JSON.parse(source('_locales/'+lang+'/messages.json'));
  assert.equal(strings.optionsShortcutSentence.placeholders.shortcut.content,'$1');
 }
 assert.match(source('JS/options.js'),/getMessage\("optionsShortcutSentence",\[shortcut\]\)/);
});

test('editing matching link changes visible URL to match new destination',()=>{
 const x=newContext();
 const original='https://drissner.media/x';
 const link={textContent:original,getAttribute:()=>original};
 const element={nodeType:1,closest:()=>link};
 const range={commonAncestorContainer:element,startContainer:element,endContainer:element,collapsed:true};
 let inserted='',selected=null;
 const selection={rangeCount:1,getRangeAt:()=>range,removeAllRanges(){},addRange(r){selected=r;}};
 x.ctx.document={body:{isContentEditable:true,contains:()=>true},
  createRange:()=>({selectNode(n){this.node=n}}),
  execCommand:(mode,_show,html)=>{inserted=html;return true;}};
 x.ctx.window.getSelection=()=>selection;
 const got=vm.runInContext(`performComposeInsertion('https://sho.rt/new','${original}',false)`,x.ctx);
 assert.equal(got.ok,true);
 assert.equal(inserted,'<a href="https://sho.rt/new">https://sho.rt/new</a>');
 assert.equal(selected.node,link);
});

test('editing an unrelated hyperlink is rejected and does not modify email',()=>{
 const x=newContext();
 const original='https://different.example.org/';
 const link={textContent:'Website',getAttribute:()=>original};
 const ancestor={nodeType:1,closest:()=>link};
 const range={commonAncestorContainer:ancestor,startContainer:ancestor,endContainer:ancestor,collapsed:true};
 x.ctx.document={body:{isContentEditable:true,contains:()=>true},
  execCommand:()=>{throw Error('must not modify email')}};
 x.ctx.window.getSelection=()=>({rangeCount:1,getRangeAt:()=>range});
 const got=vm.runInContext(`performComposeInsertion('https://sho.rt/new','https://example.org/',false)`,x.ctx);
 assert.equal(got.ok,false);
 assert.match(got.reason,/different hyperlink/);
});

test('selecting a sentence narrows insertion to the URL within selected text',()=>{
 const x=newContext();
 const text='See https://example.org/article and read it.';
 const node={nodeType:3,data:text,textContent:text,parentElement:{closest:()=>null}};
 const range={commonAncestorContainer:node,startContainer:node,endContainer:node,
   startOffset:0,endOffset:text.length,collapsed:false};
 let narrowed=null;
 x.ctx.document={body:{isContentEditable:true,contains:()=>true},
  createRange:()=>({setStart(node,at){this.start=at;},setEnd(node,at){this.end=at;}}),
  execCommand:()=>true};
 x.ctx.window.getSelection=()=>({rangeCount:1,getRangeAt:()=>range,toString:()=>text,
  removeAllRanges(){},addRange(r){narrowed=r;}});
 const got=vm.runInContext("performComposeInsertion('https://sho.rt/new','https://example.org/article',false)",x.ctx);
 assert.equal(got.ok,true);
 assert.equal(narrowed.start,text.indexOf('https://'));
 assert.equal(narrowed.end,text.indexOf('https://')+'https://example.org/article'.length);
});

test('bulk submission never overlaps YOURLS create requests',async()=>{
 const x=newContext();
 const elements={}, handlers={};
 for(const id of ['bulk-input','bulk-preview','bulk-start','bulk-stop','bulk-copy','bulk-results','bulk-progress','bulk-size','bulk-status']){
  elements[id]={value:'',disabled:false,textContent:'',replaceChildren(){},appendChild(){},addEventListener(event,fn){handlers[id+':'+event]=fn;}};
 }
 elements['bulk-input'].value='https://example.org/a\nhttps://example.org/b\ninvalid-line\nhttps://example.org/c';
 elements['bulk-size'].value='5';
 let active=0,max=0;
 const browser={i18n:{getMessage:()=>'',getUILanguage:()=> 'en'},
  runtime:{sendMessage:async msg=>{
    if(msg.type==='CHECK_CONNECTION')return {ok:true};
    if(msg.type==='LOG_BULK')return {ok:true};
    active++;max=Math.max(active,max);
    await new Promise(r=>setTimeout(r,3));active--;
    return {ok:true,shortUrl:'https://sho.rt/X'};
  }}};
 const document={documentElement:{},getElementById:id=>elements[id],querySelectorAll:()=>[],
  createDocumentFragment:()=>({appendChild(){}}),createElement:()=>({appendChild(){},set textContent(v){},set href(v){}})};
 const H={validHttpUrl:str=>/^https?:\/\//.test(str)?str:''};
 const ctx={window:{Helpers:H},browser,document,navigator:{clipboard:{writeText:async value=>clipboardWrites.push(value)}},console};
 vm.createContext(ctx);vm.runInContext(source('JS/bulk.js'),ctx);
 await handlers['bulk-start:click']();
 assert.equal(max,1);
 assert.equal(active,0);
 assert.equal(elements['bulk-progress'].value,100);
});
test('HTML insertion does not create nested links when a paragraph crosses an anchor',()=>{
 const x=newContext();
 const target='https://example.org/';
 const anchor={textContent:target,getAttribute:()=>target};
 const childNode={nodeType:3,textContent:target,parentElement:{closest:()=>anchor}};
 const whole='More details: '+target+' and other words';
 const top={nodeType:1,closest:()=>null};
 const range={commonAncestorContainer:top,startContainer:top,endContainer:top,collapsed:false,
  compareBoundaryPoints:which=>which===2?1:-1};
 let selected,html;
 x.ctx.document={body:{isContentEditable:true,contains:()=>true},
  createTreeWalker:()=>{let count=0;return {nextNode:()=>count++===0?childNode:null};},
  createRange:()=>({setStart(node){this.startContainer=node;},setEnd(node){this.endContainer=node;},selectNode(node){this.anchor=node}}),
  execCommand:(cmd,_view,content)=>{html=content;return true;}};
 x.ctx.window.getSelection=()=>({rangeCount:1,getRangeAt:()=>range,toString:()=>whole,
  removeAllRanges(){},addRange(r){selected=r;}});
 x.ctx.Range={START_TO_START:0,END_TO_END:2};
 x.ctx.NodeFilter={SHOW_TEXT:4};
 const result=vm.runInContext("performComposeInsertion('https://sho.rt/Q','https://example.org/',false)",x.ctx);
 assert.equal(result.ok,true);
 assert.equal(selected.anchor,anchor);
 assert.equal(html,'<a href="https://sho.rt/Q">https://sho.rt/Q</a>');
});
test('dashboard has explicit Create and Update actions and forwards editor original',()=>{
 const html=source('dashboard.html'),js=source('JS/dashboard.js');
 assert.match(html,/id="manual-submit"/);
 assert.match(html,/id="manual-update"/);
 assert.match(js,/async function createNew\(/);
 assert.match(js,/async function updateExisting\(/);
 assert.doesNotMatch(js,/manual-long"\)\.addEventListener\("input"/);
 assert.match(source('JS/popup.js'),/original: lastShortenedPair\.longUrl/);
 assert.match(source('JS/background.js'),/message\.original \? requireTarget\(message\.original\)/);
});


test('quoted HTML single-node selection uses raw Range offsets (not whitespace-normalized Selection.toString)',()=>{
 const x=newContext();
 const raw='Siehe\n    https://example.org/artikel ok';
 const original='https://example.org/artikel';
 const node={nodeType:3,data:raw,textContent:raw,parentElement:{closest:()=>null}};
 const range={commonAncestorContainer:node,startContainer:node,endContainer:node,
  startOffset:0,endOffset:raw.length,collapsed:false};
 let selected=null;
 x.ctx.document={body:{isContentEditable:true,contains:()=>true},
  createRange:()=>({setStart(n,at){this.startNode=n;this.start=at;},setEnd(n,at){this.endNode=n;this.end=at;}}),
  execCommand:()=>true};
 // Browser selection flattening normalizes linebreak and indentation.
 x.ctx.window.getSelection=()=>({rangeCount:1,getRangeAt:()=>range,
  toString:()=>raw.replace(/\s+/g,' '),removeAllRanges(){},addRange(r){selected=r;}});
 const got=vm.runInContext(`performComposeInsertion('https://sho.rt/abc','${original}',false)`,x.ctx);
 assert.equal(got.ok,true);
 assert.equal(selected.start,raw.indexOf(original));
 assert.equal(selected.end,raw.indexOf(original)+original.length);
 assert.equal(raw.slice(0,selected.start),'Siehe\n    ');
 assert.equal(raw.slice(selected.end),' ok');
});

test('popup ties a short URL to its exact shortening request and rejects stale targets',()=>{
 const js=source('JS/popup.js');
 assert.match(js,/let lastShortenedPair = null/);
 assert.match(js,/lastShortenedPair = \{ longUrl: url, shortUrl: response\.shortUrl \}/);
 assert.match(js,/lastShortenedPair\.shortUrl !== url/);
 assert.match(js,/H\.validHttpUrl\(\$\("longUrl"\)\.value\) !== lastShortenedPair\.longUrl/);
 assert.match(js,/original: lastShortenedPair\.longUrl/);
});

test('dashboard never carries a used custom keyword into the next create',()=>{
 const js=source('JS/dashboard.js');
 const create=js.split('async function createNew(event) {')[1].split('async function updateExisting()')[0];
 assert.match(create,/\$\("manual-keyword"\)\.value = "";/);
 assert.match(js,/async function updateExisting/);
});

test('Arabic localized wording and selective vocalization',()=>{
 const ar=JSON.parse(source('_locales/ar/messages.json'));
 const dict=Object.fromEntries(Object.entries(ar).map(([k,v])=>[k,v.message]));
 assert.equal(dict.popupBtnDelete,'احذف');
 assert.equal(dict.optionsBtnTest,'اختبر الاتصال');
 assert.equal(dict.optionsStatusLoaded,'تم تحميل الإعدادات المحفوظة. انقر على «اختبر الاتصال».');
 assert.equal(dict.bulkHeading,'اختصار مجموعة من الروابط');
 assert.equal(dict.bulkInput,'الروابط المراد اختصارها');
 assert.equal(dict.bulkPreview,'عاين');
 assert.equal(dict.dashLookup,'ابحث في YOURLS');
 assert.equal(dict.dashUpdateExisting,'عدّل الرابط الحالي');
 assert.equal(dict.dashEdit,'عدّل');
 assert.equal(dict.popupBtnDownloadQr,'نزّل رمز QR');
 assert.ok(dict.popupStatusShortening.startsWith('جارٍ '));
 assert.ok(dict.popupStatusFetchingStats.startsWith('جارٍ '));
 assert.equal(dict.popupStatsLabel,'إحصاءات (رابط مختصر أو كلمة)');
 assert.ok(dict.extensionDescription.includes('نافذة كتابة الرسالة'));
 assert.ok(dict.popupStatusInserted.includes('نافذة كتابة الرسالة'));
 assert.ok(dict.optionsShortcutUnassigned.includes('شريط الأدوات'));
 assert.ok(dict.optionsShortcutUnassigned.includes(dict.optionsBtnEditShortcuts));
 assert.ok(!Object.values(dict).some(m => m.includes('إحصائيات') || m.includes('محرر الإنشاء')));
 for(const [key,message] of Object.entries(dict)){
   const deVocalized=message.replaceAll('جارٍ','جار').replaceAll('عدّل','عدل').replaceAll('نزّل','نزل');
   assert.doesNotMatch(deVocalized,/[\u064b-\u065f\u0670]/,key+' contains unexpected vocalization');
 }
});

test('German localized insertion and shortcut terms match buttons',()=>{
 const de=JSON.parse(source('_locales/de/messages.json'));
 assert.match(de.popupStatusInserted.message,/in das Verfassenfenster/);
 assert.ok(de.optionsShortcutUnassigned.message.includes(de.optionsBtnEditShortcuts.message));
});


test('released QR generator, ASCII-canonical QR payload, four-module quiet zone',()=>{
 const lib=source('JS/qrcode.js'), pop=source('JS/popup.js');
 assert.equal(JSON.parse(source('package.json')).version,'2.0.14');
 assert.match(lib,/QR Code Generator for JavaScript/);
 assert.match(pop,/qrcode\(0, "H"\)/);
 assert.match(pop,/qr\.addData\(new URL\(value\)\.href, \"Byte\"\)/);
 assert.match(pop,/marginModules = 4/);
 assert.doesNotMatch(pop,/new QRCode\(/);
});

test('German compose-window and options-menu labels are consistent',()=>{
 const de=JSON.parse(source('_locales/de/messages.json'));
 for(const [k,v] of Object.entries(de)) assert.doesNotMatch(v.message,/Verfassen-Fenster|unter dem ⚙️ Menü/,k);
 assert.match(de.optionsShortcutChange.message,/im ⚙️-Menü/);
});

// v2.0.5 localization regression tests: translated help text must not mask the updated HTML copy.
test('2.0.5 dashboard Create/Edit/Update help text is shown in English and German',()=>{
 const html=source('dashboard.html');
 assert.match(html,/data-i18n-key="dashManualHelp"/);
 for(const lang of ['en','de']) {
  const msg=JSON.parse(source('_locales/'+lang+'/messages.json')).dashManualHelp.message;
  assert.ok(msg.length>100);
  if(lang==='en') {assert.match(msg,/Create/); assert.match(msg,/Edit/); assert.match(msg,/Check YOURLS/); assert.match(msg,/Update existing link/);} 
  else {assert.match(msg,/Kurz-URL erstellen/); assert.match(msg,/Bearbeiten/); assert.match(msg,/YOURLS prüfen/); assert.match(msg,/Bestehenden Link ändern/);}
 }
});
test('2.0.5 Arabic and English consistency corrections',()=>{
 const ar=JSON.parse(source('_locales/ar/messages.json'));
 assert.match(ar.popupErrorNoCompose.message,/نافذة كتابة رسالة/);
 assert.equal(ar.optionsApiSignatureLabel.message,'رمز توقيع API');
 assert.equal(ar.commandShortenDescription.message,'افتح نافذة kURL لاختصار الروابط.');
 assert.ok(ar.commandOpenReaderDescription.message.includes('kURL'));
 const en=JSON.parse(source('_locales/en/messages.json'));
 for(const key of ['optionsShortcutChange','commandShortenDescription','commandOpenReaderDescription']) {
  assert.match(en[key].message,/kURL/); assert.doesNotMatch(en[key].message,/kurl/);
 }
});
test('2.0.5 German wording consistency and accurate privacy notice',()=>{
 const d=JSON.parse(source('_locales/de/messages.json'));
 assert.equal(d.optionsStatusSaved.message,'Einstellungen gespeichert. Testen Sie die Verbindung gegebenenfalls erneut.');
 assert.equal(d.popupTitle.message,'YOURLS-Linkkürzer');
 assert.equal(d.popupBtnShorten.message,'Kürzen');
 assert.match(d.popupStatusShortening.message,/gekürzt/);
 assert.match(d.popupInfoAlreadyShortened.message,/gekürzt/);
 assert.equal(d.dashboardNoLinksFound.message,'Noch keine Links vorhanden.');
 assert.equal(d.dashboardStatusLoading.message,'Wird geladen …');
 assert.match(d.logExplanation.message,/API-Token/);
 assert.doesNotMatch(d.logExplanation.message,/API-Schlüssel/);
 for(const k of ['popupBtnShorten','popupStatusShortening','popupInfoAlreadyShortened','commandShortenDescription'])
  assert.doesNotMatch(d[k].message,/Verkürz/);
});
test('2.0.5 npm library declaration and unchanged vendored source',()=>{
 const vendor=source('VENDOR.md');
 assert.match(vendor,/qrcode-generator@2\.0\.4\/dist\/qrcode\.js/);
 assert.doesNotMatch(vendor,/has not yet been performed/);
 const crypto=require('node:crypto');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'JS/qrcode.js'))).digest('hex'),'79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c');
});

// v2.0.6 strictly wording-only regression checks.
test('2.0.6 optional copy edits match visible controls and released vendoring metadata',()=>{
 const en=JSON.parse(source('_locales/en/messages.json'));
 const de=JSON.parse(source('_locales/de/messages.json'));
 const ar=JSON.parse(source('_locales/ar/messages.json'));
 assert.equal(en.optionsShortcutChange.message,"You can change the kURL shortcut in the ⚙️ menu of Thunderbird's Add-ons Manager.");
 assert.equal(ar.optionsShortcutChange.message,'يمكنك تغيير اختصار لوحة المفاتيح من قائمة ⚙️ في مدير إضافات Thunderbird.');
 assert.match(ar.dashManualHelp.message,/«أنشئ رابطا مختصرا»/);
 for(const key of ['dashEdit','dashLookup','dashUpdateExisting','dashCreateNew'])
   assert.ok(ar.dashManualHelp.message.includes('«'+ar[key].message+'»'),'Arabic dashboard help must name the actual '+key+' button');
 assert.equal(de.optionsAutoCopyLabel.message,'Kurz-URL automatisch in die Zwischenablage kopieren');
 assert.equal(de.dashboardLabelTotalLinks.message,'Links gesamt');
 assert.equal(de.dashboardLabelTotalClicks.message,'Klicks gesamt');
 assert.equal(de.popupBtnToggleJson.message,'JSON ein-/ausblenden');
 assert.equal(de.dashRegenerate.message,'Kurz-URL neu erzeugen');
 for(const [key,v] of Object.entries(de)) {
   assert.ok(!v.message.includes('...'), 'mixed ellipsis in '+key);
   assert.ok(!/(?<!\s)…/.test(v.message), 'missing space before ellipsis in '+key);
 }
 const vendor=source('VENDOR.md');
 assert.doesNotMatch(vendor,/external reviewer|independently compared/i);
 assert.match(vendor,/SHA-256 of bundled file/);
 assert.equal(JSON.parse(source('manifest.json')).version,'2.0.14');
});

test('2.0.7 opens settings dashboard as a full tab with helper onboarding',()=>{
 const m=JSON.parse(source('manifest.json'));
 assert.equal(m.options_ui.open_in_tab,true);
 const html=source('dashboard.html');
 for(const id of ['helper-setup','helper-instructions','helper-source-link']) assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('class="card dashboard-shell"'));
 const js=source('JS/dashboard.js');
 assert.ok(js.includes('helperInitialState'));
 assert.doesNotMatch(js,/\$\("helper-setup"\)\.hidden\s*=\s*info\.helperReady/);
 assert.match(source('JS/background.js'), /contextFeedback\(tab, i18nArg\("contextCopied"/);
 for(const lang of ['en','de']) {
   const data=JSON.parse(source('_locales/'+lang+'/messages.json'));
   assert.ok(data.helperStep2.message.includes('user/plugins/kurl-helper/'));
 }
});

// 2.0.8 regression tests for live feedback, helper status, ranking and log UI.
test('right-click shortening copies and emits a native notification even when toast injection fails',async()=>{
 const x=newContext();
 await x.click({menuItemId:'kurl-quick-copy',linkUrl:'https://example.org/article'},{id:5,type:'mail'});
 assert.deepEqual(x.clipboardWrites,['https://sho.rt/AbC']);
 assert.ok(x.storage.kurlActivityLog.some(x=>x.action==='RIGHT_CLICK_COPY'));
 assert.ok(x.sentNotifications.length>=1);
 assert.match(x.sentNotifications[0].message,/Copied to clipboard/);
});
test('context-menu entry points are static and not dependent on onShown timing',()=>{
 const js=source('JS/background.js');
 assert.doesNotMatch(js,/menus\.onShown\.addListener/);
 assert.match(js,/KURL_MENU_COPY/);
 assert.match(js,/ensureMenus\(\)/);
});
test('top ranking and helper pill rendered without misleading stats buttons',()=>{
 const js=source('JS/dashboard.js');
 const html=source('dashboard.html');
 assert.match(js,/rankBadge\.textContent/);
 assert.match(js,/"Rank"/);
 assert.match(js,/"helper-indicator"/);
 assert.match(html,/id="helper-indicator"/);
 assert.doesNotMatch(js,/makeButton\(t\("popupBtnStats"/);
});
test('log supports paginated display and plain text export, not unbounded DOM nodes',()=>{
 const js=source('JS/logs.js');const html=source('logs.html');
 assert.match(js,/PAGE_SIZE = 15/);
 assert.match(js,/entries\.slice\(page \* PAGE_SIZE/);
 for(const id of ['log-page','log-prev','log-next','log-copy','log-download'])
   assert.ok(html.includes('id="'+id+'"'));
 assert.match(js,/text\/plain;charset=utf-8/);
});
test('connection test persists valid settings only after a successful response',()=>{
 const js=source('JS/options.js'),html=source('options.html');
 assert.ok(js.indexOf('if (!result?.ok) throw')<js.indexOf('await H.setSettings(finalSettings)'));
 assert.match(html,/data-i18n-key="optionsBtnTestAndSave"/);
});

test('old hidden 2.0.7 menu is upgraded to a visible 2.0.8 insert menu',async()=>{
 const x=newContext();
 // Previously persisted menu from an event-page generation that hid Insert.
 x.menus.push({id:'kurl-quick-insert',contexts:['link','selection','compose_body'],visible:false});
 await x.install();await vm.runInContext('menuInitialization',x.ctx);
 assert.equal(x.menus.length,2);
 assert.equal(x.menus.find(x=>x.id==='kurl-quick-insert').visible,true);
});

test('2.0.9 bundles the independent YOURLS Helper with valid plugin metadata',()=>{
 const php=source('helper/kurl-helper/plugin.php');
 assert.match(php,/^<\?php\n\/\*\nPlugin Name: kURL Helper\n/);
 assert.match(php,/Version: 1\.1\.7\n/);
 assert.doesNotMatch(php.split('*/')[0],/WordPress/i);
 for(const action of ['kurl_ping','kurl_delete','kurl_find_by_url','kurl_regenerate'])
   assert.ok(php.includes("'api_action_"+action+"'"),action+' API missing');
 const js=source('JS/dashboard.js');
 assert.match(js,/runtime\.getURL\("helper\/kurl-helper\/plugin\.php"\)/);
 assert.match(js,/clipboard\.writeText\(code\)/);
 assert.match(js,/link\.download = "plugin\.php"/);
 assert.match(js,/helperInitialState/);
 const html=source('dashboard.html');
 for(const id of ['helper-setup','helper-instructions','helper-code-details','helper-code','helper-copy','helper-download','helper-file-status'])
   assert.ok(html.includes('id="'+id+'"'),id+' not in dashboard');
 assert.doesNotMatch(html,/kurl-wordpress|WordPress repository/);
 for(const lang of ['en','de']) {
  const strings=JSON.parse(source('_locales/'+lang+'/messages.json'));
  for(const key of ['helperDownload','helperCopy','helperShowCode','helperSource','helperStep2'])assert.ok(strings[key]?.message);
  assert.doesNotMatch(strings.helperSource.message,/WordPress/i);
 }
});

// 2.0.10 opt-out confirmation preference (copy behavior always unchanged).
test('notifications enabled by default and disabled settings are honored in background',async()=>{
 const x=newContext();
 assert.equal(x.storage.showCopyNotifications,true);
 await x.click({menuItemId:'kurl-quick-copy',linkUrl:'https://example.org/'},{id:2});
 assert.deepEqual(x.clipboardWrites,['https://sho.rt/AbC']);
 assert.equal(x.sentNotifications.length,1);
 const y=newContext({showCopyNotifications:false});
 await y.click({menuItemId:'kurl-quick-copy',linkUrl:'https://example.org/'},{id:2});
 assert.deepEqual(y.clipboardWrites,['https://sho.rt/AbC']);
 assert.equal(y.sentNotifications.length,0);
 await y.send({type:'CHECK_CONNECTION'});
 assert.equal(y.storage.showCopyNotifications,false);
});
test('error feedback remains visible when success confirmations disabled',async()=>{
 const x=newContext({showCopyNotifications:false});
 await x.click({menuItemId:'kurl-quick-copy',selectionText:'not a URL'},{id:1});
 assert.equal(x.sentNotifications.length,1);
 assert.match(x.sentNotifications[0].message,/Select a complete HTTP/);
});
test('global feedback setting is shared by both pages without saving the API token',()=>{
 const options=source('JS/options.js'),dashboard=source('JS/dashboard.js');
 const helpers=source('JS/helpers.js');
 assert.match(helpers,/showCopyNotifications: data\.showCopyNotifications !== false/);
 assert.match(helpers,/showCopyNotifications: true/);
 assert.match(options,/setSettings\(\{showCopyNotifications: choice\}\)/);
 assert.match(dashboard,/setSettings\(\{showCopyNotifications: choice\}\)/);
 assert.match(dashboard,/browser\.storage\.onChanged/);
 assert.match(options,/browser\.storage\.onChanged/);
 const dashboardHtml=source('dashboard.html'),optionsHtml=source('options.html');
 assert.match(dashboardHtml,/id="dash-copy-notifications"/);
 assert.match(dashboardHtml,/id="copy-toast".*aria-live="polite"/);
 assert.match(optionsHtml,/id="showCopyNotifications"/);
 for(const lang of ['en','de','ar']){
  const locale=JSON.parse(source('_locales/'+lang+'/messages.json'));
  for(const key of ['optionsCopyFeedbackLabel','optionsCopyFeedbackHint','dashCopyToast'])
   assert.ok(locale[key]?.message,key+' missing for '+lang);
 }
});
test('portable WebExtension APIs instead of OS-specific commands',()=>{
 const manifest=JSON.parse(source('manifest.json'));
 assert.equal(manifest.manifest_version,3);
 const js=['background','dashboard','options','popup','bulk','logs','helpers'].map(x=>source('JS/'+x+'.js')).join('\n');
 assert.doesNotMatch(js,/process\.platform|child_process|os\.platform|navigator\.platform|xdg-open|osascript|powershell|execFileSync/);
 assert.deepEqual(manifest.optional_host_permissions,['https://*/*']);
 assert.ok(manifest.permissions.includes('notifications'));
 assert.ok(manifest.permissions.includes('clipboardWrite'));
});

// 2.0.11: YOURLS 1.10.5+ signs requests with the new API secret.
test('recognizes native YOURLS 403 Please log in and does not require a Thunderbird login',async()=>{
 const x=newContext({apiFailure:{status:403,errorCode:'403',message:'Please log in'}});
 const result=await x.send({type:'CHECK_CONNECTION'});
 assert.equal(result.ok,false);
 assert.equal(result.errorCode,'AUTH_REJECTED');
 assert.match(result.reason,/Admin/);
 assert.match(result.reason,/Tools/);
 assert.match(result.reason,/kURL/);
 assert.doesNotMatch(result.reason,/Please log in/);
 assert.equal(x.calls[0].body.get('hash'),'sha256');
 assert.notEqual(x.calls[0].body.get('signature'),x.storage.apiSignature);
 assert.equal(x.calls[0].body.has('username'),false);
 assert.equal(x.calls[0].body.has('password'),false);
});
test('recognizes future access errors by HTTP/code without depending on English message',async()=>{
 for(const response of [
   {status:401,errorCode:'401',message:'New localization of error'},
   {status:403,errorCode:'403',message:'Authentication protocol changed'}
 ]){
   const x=newContext({apiFailure:response});
   const result=await x.send({type:'CHECK_CONNECTION'});
   assert.equal(result.errorCode,'ACCESS_DENIED');
   assert.match(result.reason,/HTTP 401\/403/);
 }
});
test('handles 403 HTML login page separately from malformed ordinary responses',async()=>{
 const x=newContext({apiFailure:{status:403,html:'<html><form>Log in</form></html>'}});
 const result=await x.send({type:'CHECK_CONNECTION'});
 assert.equal(result.errorCode,'ACCESS_DENIED');
 assert.doesNotMatch(result.reason,/valid JSON/);
});
test('keeps non-auth failures specific and preserves normal connection flow',async()=>{
 const x=newContext({errorMessage:'Keyword already exists'});
 const failure=await x.send({type:'SHORTEN_URL',longUrl:'https://example.org/'});
 assert.equal(failure.ok,false);
 assert.equal(failure.reason,'Keyword already exists');
 const y=newContext();
 const ok=await y.send({type:'CHECK_CONNECTION'});
 assert.equal(ok.ok,true);
 assert.equal(ok.total,12);
});
test('all ten locales explain API token recovery and provide an accessible Tools link',()=>{
 const locales=['en','de','ar','es','fr','he','ja','pt','ru','zh_CN'];
 const en=JSON.parse(source('_locales/en/messages.json'));
 for(const lang of locales){
  const d=JSON.parse(source('_locales/'+lang+'/messages.json'));
  for(const key of ['apiAuthRejected','apiAccessDenied','apiInvalidResponse','apiOpenTools']){
   assert.ok(d[key]?.message,lang+':'+key);
   assert.ok(d[key].message.includes('YOURLS'),lang+':'+key);
  }
  assert.match(d.apiAuthRejected.message,/kURL/);
  assert.match(d.apiInvalidResponse.message,/\$status\$/);
 }
 for(const [html,ids] of [
  ['options.html',['options-auth-recovery','options-auth-tools']],
  ['dashboard.html',['dashboard-auth-recovery','dashboard-auth-tools']]
 ]) for(const id of ids) assert.ok(source(html).includes('id="'+id+'"'),id);
 assert.match(source('JS/options.js'),/false, true, error.code\)/);
 assert.match(source('JS/dashboard.js'),/showAuthRecovery\(error.code\)/);
});
test('bundled YOURLS Helper 1.1.7 authenticates destructive operations',()=>{
 const php=source('helper/kurl-helper/plugin.php');
 assert.match(php,/Version: 1\.1\.7/);
 assert.match(php,/function kurl_api_require_auth\(\)/);
 for(const fn of ['kurl_api_delete','kurl_api_find_by_url','kurl_api_regenerate']){
   const pos=php.indexOf('function '+fn+'()');
   assert.ok(pos>0);
   assert.match(php.slice(pos,pos+190),/kurl_api_require_auth\(\)/,fn);
 }
 assert.match(source('JS/background.js'),/HELPER_VERSION = "1\.1\.6"/);
});
test('no status notification is inserted into the body of an outgoing message',()=>{
 const js=source('JS/background.js');
 assert.doesNotMatch(js,/contextToast\(/);
 assert.doesNotMatch(js,/kurl-context-toast/);
 assert.match(js,/setBadgeText\(\{text: value, tabId\}\)/);
});

test('HTTP response placeholder is valid and supplied as argument in all languages',()=>{
  assert.match(source('JS/background.js'),/getMessage\("apiInvalidResponse", \[String\(response.status\)\]\)/);
  for(const lang of fs.readdirSync(path.join(root,'_locales'))){
    const m=JSON.parse(source('_locales/'+lang+'/messages.json'));
    assert.equal(m.apiInvalidResponse.placeholders.status.content,'$1',lang);
    assert.match(m.apiInvalidResponse.message,/\$status\$/i,lang);
    for(const key of ['optionsBtnTestAndSave','contextSelectUrl','contextShorteningFailed','contextCopied','contextInserted','dashboardLabelClicks'])
      assert.ok(m[key]?.message,lang+': '+key);
    assert.equal(m.contextCopied.placeholders.shorturl.content,'$1');
    assert.equal(m.contextInserted.placeholders.shorturl.content,'$1');
    assert.equal(m.dashboardLabelClicks.placeholders.count.content,'$1');
  }
});

test('toolbar badges are scoped and independently cleared per tab', async()=>{
  const x=newContext();
  const scheduled=[], log=[];
  x.ctx.setTimeout=fn=>{scheduled.push(fn);return scheduled.length};
  x.ctx.clearTimeout=id=>log.push(['cancel',id]);
  const button={
    setBadgeText:async args=>log.push(['text',args.tabId,args.text]),
    setBadgeBackgroundColor:async args=>log.push(['color',args.tabId,args.color])
  };
  x.ctx.browser.action=button;
  await vm.runInContext('signalToolbar("success", 101)',x.ctx);
  await vm.runInContext('signalToolbar("error", 202)',x.ctx);
  assert.deepEqual(log.filter(v=>v[0]==='text'),[['text',101,'✓'],['text',202,'!']]);
  scheduled[0]();
  assert.deepEqual(log.filter(v=>v[0]==='text').at(-1),['text',101,'']);
  assert.equal(log.filter(v=>v[0]==='text'&&v[1]===202&&v[2]==='').length,0);
  await vm.runInContext('signalToolbar("success", 202)',x.ctx);
  assert.ok(log.some(v=>v[0]==='cancel'&&v[1]===2));
  scheduled[1](); // Old timer must not wipe the newer value on 202.
  assert.equal(log.filter(v=>v[0]==='text'&&v[1]===202&&v[2]==='').length,0);
  scheduled[2]();
  assert.deepEqual(log.filter(v=>v[0]==='text').at(-1),['text',202,'']);
});

test('macOS clicked link insertion is explicit and never injects into unrelated caret',()=>{
  const js=source('JS/background.js');
  assert.match(js,/insertUrl\(tab\.id, result\.shortUrl, url, !!info\.linkUrl\)/);
  assert.match(js,/function performComposeInsertion\(url, originalUrl, isPlainText, fromLink = false\)/);
  assert.match(js,/matches\.length === 1/);
  assert.match(js,/Several links use this URL/);
  assert.doesNotMatch(js,/^void ensureMenus\(\);/m);
});

test('Helper source pin resolves to a commit containing 1.1.7 and no obsolete references',()=>{
  const html=source('dashboard.html');
  assert.match(html,/blob\/54ef82abfe4e2389ac52faca4148a6edc64e8aa9\/helper\/kurl-helper\/plugin.php/);
  assert.doesNotMatch(html,/blob\/e6422d7/);
  assert.match(source('REVIEWER_NOTES.md'),/Thunderbird does \*\*not\*\* execute PHP/);
  assert.doesNotMatch(source('README.md'),/confirmation in the Thunderbird message\/compose content/);
  assert.match(source('.github/workflows/ci.yml'),/actions\/checkout@v7/);
});


test('RTL toggles, counters and editor errors are localized without injecting UI into compose',()=>{
 const css=source('styles.css'),js=source('JS/background.js');
 assert.match(css,/\[dir="rtl"\] input:checked \+ \.slider:before \{ transform: translateX\(-20px\); \}/);
 assert.match(css,/\.kurl-actions \.link-clicks \{ margin-block: 0; margin-inline: 0 6px; \}/);
 assert.match(css,/\.dashboard-list-columns \.link-clicks \{margin-block:0;margin-inline:0 12px/);
 assert.doesNotMatch(js,/browser\.tabs\.onRemoved/);
 assert.match(js,/setBadgeText\?\.\(\{text: "", tabId\}\)\?\.catch\?\.\(\(\) => \{\}\)/);
 for (const lang of ['ar','de','en','es','fr','he','ja','pt','ru','zh_CN']) {
  const d=JSON.parse(source('_locales/'+lang+'/messages.json'));
  for(const key of ['insertAmbiguousLink','insertClickedLinkMissing','insertPlainTextSelectUrl','optionsOldTokenHint'])
   assert.ok(d[key]?.message?.length>8,lang+': '+key);
 }
 for(const code of ['AMBIGUOUS_CLICKED_LINK','CLICKED_LINK_NOT_FOUND','PLAIN_TEXT_SELECT_URL'])
  assert.ok(js.includes(code));
 assert.match(source('JS/dashboard.js'),/code\.replace\(\/\\r\\n\/g, "\\n"\)/);
});

test('insertion reason codes are translated in background after frame execution',async()=>{
 const x=newContext();
 const german=JSON.parse(source('_locales/de/messages.json'));
 x.ctx.browser.i18n.getMessage=k=>german[k]?.message||'';
 const codes=['AMBIGUOUS_CLICKED_LINK','CLICKED_LINK_NOT_FOUND','PLAIN_TEXT_SELECT_URL'];
 for(const [index,code] of codes.entries()){
  let call=0;
  x.ctx.browser.scripting.executeScript=async ()=>++call===1
   ?[{frameId:0,result:true}]:[{frameId:0,result:{ok:false,reason:code}}];
  await assert.rejects(vm.runInContext('insertUrl(1,"https://sho.rt/new","https://example.com",true)',x.ctx),
   error=>error.message===german[['insertAmbiguousLink','insertClickedLinkMissing','insertPlainTextSelectUrl'][index]].message);
 }
});


test('Helper 1.1.7 is versioned independently while add-on accepts secure 1.1.6',async()=>{
 const sourcePHP=source('helper/kurl-helper/plugin.php');
 assert.match(sourcePHP,/Version: 1\.1\.7/);
 assert.match(sourcePHP,/'kurl_helper_version' => '1\.1\.7'/);
 assert.match(source('JS/background.js'),/HELPER_VERSION = "1\.1\.6"/);
 for(const helperVersion of ['1.1.6','1.1.7']) {
  const x=newContext({helperVersion});
  const result=await x.send({type:'GET_INFO'});
  assert.equal(result.data.helperReady,true,helperVersion);
 }
});

test('all right-click labels and safe insertion errors localized explicitly',()=>{
 const locales=['en','de','ar','es','fr','he','ja','pt','ru','zh_CN'];
 for(const lang of locales){
  const entries=JSON.parse(source('_locales/'+lang+'/messages.json'));
  for(const key of ['menuQuickCopy','menuQuickInsert','insertCannotSafely']){
   assert.ok(entries[key]?.message?.length>5,lang+':'+key);
   assert.ok(entries[key].message.toLowerCase().includes('kurl') || key==='insertCannotSafely',lang+':'+key);
  }
 }
 const ar=JSON.parse(source('_locales/ar/messages.json'));
 assert.equal(ar.menuQuickCopy.message,'kURL: اختصار ونسخ');
 assert.equal(ar.menuQuickInsert.message,'kURL: اختصار وإدراج');
 assert.ok(ar.insertPlainTextSelectUrl.message.includes('«'+ar.menuQuickInsert.message+'»'));
});

test('legacy token hint is shown only after authentication rejection, never on initial load',()=>{
 const s=source('JS/options.js');
 const init=s.slice(s.indexOf('async function init() {'),s.indexOf('$("showCopyNotifications").addEventListener'));
 assert.doesNotMatch(init,/optionsOldTokenHint/);
 assert.match(s,/authDenied && config\.apiSignature\.length === 10/);
 assert.match(init,/optionsStatusLoaded/);
});
