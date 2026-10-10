"""Non-blocking legacy-token advice after failed auth, never on initial settings."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pg=browser.new_page()
 pg.set_content((root/'options.html').read_text())
 pg.evaluate('''() => {
 const store={yourlsUrl:'https://sho.rt',apiSignature:'1234567890',autoCopy:true,showCopyNotifications:true};
 window.__writes=0;
 window.browser={
  i18n:{getMessage:()=>'',getUILanguage:()=>'en-US'},
  storage:{local:{get:async key=>typeof key==='string'?{[key]:store[key]}:{...key,...store},set:async()=>window.__writes++}},
  permissions:{request:async()=>true},commands:{getAll:async()=>[]},
  runtime:{sendMessage:async()=>({ok:false,errorCode:'AUTH_REJECTED',reason:'YOURLS refused API credentials.'})}
 };
 }''')
 pg.add_script_tag(content=(root/'JS/helpers.js').read_text())
 pg.add_script_tag(content=(root/'JS/options.js').read_text())
 pg.wait_for_function('document.querySelector("#status").textContent.includes("Settings loaded")')
 assert 'ten-character' not in pg.locator('#status').inner_text()
 pg.click('#test')
 pg.wait_for_function('document.querySelector("#options-auth-recovery").hidden === false')
 assert 'ten-character' in pg.locator('#status').inner_text()
 assert pg.evaluate('window.__writes')==0
 print('Legacy signature warning only after failed auth; no invalid token saved: PASS')
 browser.close()
