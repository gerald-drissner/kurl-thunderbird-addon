#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=browser.new_context()
 mock = '''
 const storage={yourlsUrl:'https://sho.rt',apiSignature:'old-signature',autoCopy:true,showCopyNotifications:true};
 window.__checkSaves=0;
 window.browser={
   i18n:{getMessage:(key)=>({apiOpenTools:'YOURLS Tools page'}[key]||''),getUILanguage:()=>'en-US'},
   permissions:{request:async()=>true},
   commands:{getAll:async()=>[]},
   storage:{local:{get:async arg=>typeof arg==='string'?{[arg]:storage[arg]}:Object.assign({},arg,storage),set:async values=>{window.__checkSaves++;Object.assign(storage,values)}}},
   runtime:{sendMessage:async msg=>({ok:false,errorCode:'AUTH_REJECTED',reason:'YOURLS rejected the signature. Open Admin → Tools.'})}
 };
 '''
 page=c.new_page()
 page.set_content((root/'options.html').read_text())
 page.evaluate(mock)
 page.add_script_tag(content=(root/'JS/helpers.js').read_text())
 page.add_script_tag(content=(root/'JS/options.js').read_text())
 page.wait_for_function("document.getElementById('apiSignature').value==='old-signature'")
 page.click('#test')
 page.wait_for_function("document.getElementById('options-auth-recovery').hidden===false")
 assert page.locator('#status').inner_text().find('YOURLS rejected the signature')!=-1
 assert page.locator('#options-auth-tools').get_attribute('href')=='https://sho.rt/admin/tools.php'
 assert page.evaluate('window.__checkSaves')==0,'Bad credentials were saved'
 print('OPTIONS AUTH UX: recovery link shown, credentials not saved — PASS')
 browser.close()
