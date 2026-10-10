from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
source=(root/'helper/kurl-helper/plugin.php').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(accept_downloads=True)
 page.set_default_timeout(3000)
 page.set_content((root/'dashboard.html').read_text())
 page.evaluate('''
 Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
     writeText:async s=>{window.__copied=s;}
 } });
 window.browser = {
   i18n: {getMessage:k=>'',getUILanguage:()=>'en-US'},
   storage: {local: {get:async defaults=>({...defaults,showCopyNotifications:true}),set:async()=>{}},onChanged:{addListener:()=>{}}},
   runtime: {
     getURL: path => 'https://example.invalid/'+path,
     sendMessage: async m => m.type==='GET_INFO' ? {ok:true,data:{base:'https://sho.rt',totalLinks:17,totalClicks:512,helperReady:true,helperVersion:'1.1.5',yourlsVersion:'1.10.6'}}:
       m.type==='GET_LOG' ? {ok:true,data:[]} : {ok:true,data:{links:{}}}
   }
 };
 ''')
 page.evaluate("""(helper) => {
   window.fetch = async () => ({ok:true,text:async()=>helper});
 }""", source)
 page.add_script_tag(content=(root/'JS/helpers.js').read_text())
 page.add_script_tag(content=(root/'JS/dashboard.js').read_text())
 print('dashboard JS loaded',page.locator('#dashboard-feedback').text_content(), flush=True); print('helper status',page.locator('#helper-indicator').text_content(), flush=True); page.wait_for_function("document.querySelector('#helper-indicator').textContent.includes('INSTALLED / OK')")
 assert not page.locator('#helper-indicator').is_visible(), 'ready Helper must not dominate dashboard'
 assert not page.locator('#helper-panel').evaluate('(x)=>x.open'), 'installed Helper panel starts collapsed'
 assert page.locator('#helper-setup').is_visible(), 'helper installer hidden on healthy install'
 assert not page.locator('#helper-instructions').evaluate('(x)=>x.open'), 'instructions should be collapsed when Helper exists'
 page.locator('#helper-panel').evaluate('(e)=>{e.open=true;}')
 print('opening instructions',flush=True)
 page.locator('#helper-instructions').evaluate('(e)=>{e.open=true;}')
 print('opening code',flush=True)
 page.locator('#helper-code-details').evaluate('(e)=>{e.open=true;}')
 print('code debug',page.locator('#helper-code').text_content()[:100], 'status',page.locator('#helper-file-status').text_content(),flush=True)
 page.wait_for_function("document.querySelector('#helper-code').textContent.startsWith('<?php')")
 preview=page.locator('#helper-code').text_content()
 assert preview==source, f'preview differs: {len(preview)} vs {len(source)}'
 print('preview loaded',flush=True);page.locator('#helper-copy').click()
 page.wait_for_function('typeof window.__copied === "string"')
 assert page.evaluate('window.__copied')==source
 print('clipboard passed',flush=True); page.set_default_timeout(3000)
 with page.expect_download(timeout=3000) as download_info:
  page.locator('#helper-download').click()
 download=download_info.value
 assert download.suggested_filename=='plugin.php',download.suggested_filename
 dl_path=root/'tests'/'_tmp_plugin.php'
 download.save_as(str(dl_path))
 assert dl_path.read_text()==source
 dl_path.unlink()
 print('PASS helper ready state compact, expandable on request')
 print('PASS source preview exact bytes',len(source),'characters')
 print('PASS clipboard exact source')
 print('PASS downloaded plugin.php exact source')
 browser.close()

