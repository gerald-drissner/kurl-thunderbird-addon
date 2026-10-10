from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    page.set_content((root/'dashboard.html').read_text())
    page.evaluate('''() => {
       window.__saved={yourlsUrl:'https://sho.rt',apiSignature:'test-token',autoCopy:true,showCopyNotifications:true};
       window.__clipboard=[];
       window.__changes=[];
       Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>{window.__clipboard.push(s);}}});
       window.browser={i18n:{getMessage:()=>'',getUILanguage:()=> 'en-US'},
         storage:{local:{get:async defaults=>({...defaults,...window.__saved}),set:async o=>{Object.assign(window.__saved,o); window.__changes.forEach(f=>f({showCopyNotifications:{newValue:o.showCopyNotifications}},'local'));}},onChanged:{addListener:f=>window.__changes.push(f)}},
         runtime:{getURL:p=>'moz-extension://demo/'+p,sendMessage:async msg=>{
           if(msg.type==='GET_INFO')return {ok:true,data:{base:'https://sho.rt',totalLinks:18,totalClicks:100,helperReady:true,helperVersion:'1.1.5',yourlsVersion:'1.10.6'}};
           if(msg.type==='GET_LOG')return {ok:true,data:[]};
           if(msg.type==='GET_TOP_LINKS')return {ok:true,data:{links:{one:{shorturl:'https://sho.rt/abc',url:'https://example.org/',title:'Example',clicks:12}}}};
           if(msg.type==='GET_RECENT_LINKS')return {ok:true,data:{links:{}}};
           return {ok:true};
         }}
       };
       window.fetch = async () => ({ok:true,text:async()=> '<?php test code'});
    }''')
    page.add_script_tag(content=(root/'JS/helpers.js').read_text())
    page.add_script_tag(content=(root/'JS/dashboard.js').read_text())
    page.locator('#top-links-container button').first.wait_for(timeout=5000)
    copy=page.locator('#top-links-container button').filter(has_text='Copy')
    copy.click()
    page.wait_for_function("window.__clipboard.length===1")
    assert page.evaluate('window.__clipboard[0]')=='https://sho.rt/abc'
    assert page.locator('#copy-toast').is_visible()
    assert 'Copied to clipboard' in page.locator('#copy-toast').inner_text()
    print('PASS dashboard top-link copy shows brief toast')
    page.locator('#dash-copy-notifications').uncheck()
    page.wait_for_function("window.__saved.showCopyNotifications===false")
    assert page.locator('#copy-toast').is_hidden()
    copy.click()
    page.wait_for_function('window.__clipboard.length===2')
    assert page.locator('#copy-toast').is_hidden()
    print('PASS dashboard opt-out saves instantly, copy still works, no toast')
    page.locator('#dash-copy-notifications').check()
    copy.click()
    page.wait_for_function('window.__clipboard.length===3')
    assert page.locator('#copy-toast').is_visible()
    page.wait_for_timeout(3200)
    assert page.locator('#copy-toast').is_hidden()
    print('PASS opt-in restores 2.8-second auto-dismiss toast')
    # Also exercise manual copy confirmation; text remains unchanged.
    page.locator('#manual-result').evaluate('(el)=>el.value="https://sho.rt/manual"')
    page.locator('#manual-copy').evaluate('(el)=>el.disabled=false')
    page.locator('#manual-copy').click()
    page.wait_for_function('window.__clipboard.length===4')
    assert page.evaluate('window.__clipboard[3]')=='https://sho.rt/manual'
    assert 'https://sho.rt/manual' in page.locator('#copy-toast').inner_text()
    print('PASS manual result copy uses same confirmation')
    # Settings test: changing toggle must not send/save credentials or check the connection.
    settings=browser.new_page()
    settings.set_content((root/'options.html').read_text())
    settings.evaluate('''() => {
      window.__saved={yourlsUrl:'https://sho.rt',apiSignature:'unchanged-token',autoCopy:true,showCopyNotifications:false};
      window.__writes=[];
      window.browser={i18n:{getMessage:()=>'',getUILanguage:()=> 'en-US'},
       storage:{local:{get:async o=>({...o,...window.__saved}),set:async o=>{window.__writes.push(o);Object.assign(window.__saved,o);}},onChanged:{addListener:()=>{}}},
       runtime:{sendMessage:async ()=>{throw Error('Should not test connection to toggle preference');}},
       commands:{getAll:async()=>[]}};
    }''')
    settings.add_script_tag(content=(root/'JS/helpers.js').read_text())
    settings.add_script_tag(content=(root/'JS/options.js').read_text())
    settings.wait_for_function("document.querySelector('#showCopyNotifications').checked===false")
    settings.locator('#showCopyNotifications').check()
    settings.wait_for_function('window.__writes.length===1')
    assert settings.evaluate('window.__writes[0]')=={'showCopyNotifications':True}
    print('PASS Settings switch persists without API credential writes/connection test')
    browser.close()
