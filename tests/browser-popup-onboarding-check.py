"""Verify initial popup Go to Settings opens options.html directly, not the dashboard."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page()
    page.set_default_timeout(4000)
    page.set_content((root/'popup.html').read_text())
    page.evaluate('''() => {
      window.__opened=[];
      window.close=()=>{window.__closed=true;};
      window.browser={
        i18n:{getUILanguage:()=>"en-US",getMessage:()=>""},
        storage:{local:{get:async defaults=>({...defaults,yourlsUrl:"",apiSignature:""})}},
        runtime:{getURL:path=>"moz-extension://kurl/"+path,sendMessage:async()=>{throw Error("No API request permitted before setup");}},
        tabs:{create:async details=>{window.__opened.push(details.url);}}
      };
    }''')
    page.add_script_tag(content=(root/'JS/helpers.js').read_text())
    page.add_script_tag(content=(root/'JS/qrcode.js').read_text())
    page.add_script_tag(content=(root/'JS/popup.js').read_text())
    page.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
    page.locator('#setup-message').wait_for(state='visible')
    page.locator('#open-options').click()
    page.wait_for_function('window.__opened.length===1')
    assert page.evaluate('window.__opened')==['moz-extension://kurl/options.html']
    assert page.evaluate('window.__closed===true')
    print('PASS First-run toolbar popup opens direct YOURLS token settings')
    browser.close()
