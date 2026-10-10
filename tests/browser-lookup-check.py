"""Regression: two-way lookup, safe editing, clipboard, compact Helper and list-scope text."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
locales=json.loads((root/'_locales/en/messages.json').read_text())
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1200,'height':1000})
    page.set_default_timeout(5000)
    page.set_content((root/'dashboard.html').read_text())
    page.evaluate('''messages=>{
      window.__calls=[];
      window.browser={
        i18n:{getUILanguage:()=>"en-US",getMessage:(key,args)=>{
          const entry=messages[key]; if(!entry) return '';
          let message=entry.message;
          for(const [name,definition] of Object.entries(entry.placeholders||{})){
            const position=Number(String(definition.content||'').replace('$',''))-1;
            const value=(Array.isArray(args)?args[position]:args)||'';
            message=message.split('$'+name+'$').join(String(value));
          }
          return message;
        }},
        storage:{local:{get:async defaults=>({...defaults,showCopyNotifications:true}),set:async()=>{}},onChanged:{addListener:()=>{}}},
        runtime:{getURL:path=>'moz-extension://kurl/'+path,sendMessage:async m=>{
          window.__calls.push(m);
          if(m.type==='GET_INFO')return {ok:true,data:{base:'https://dri.li',totalLinks:18,totalClicks:512,helperReady:true,helperVersion:'1.1.7',yourlsVersion:'1.10.6'}};
          if(m.type==='GET_LOG')return {ok:true,data:[]};
          if(m.type==='GET_TOP_LINKS'||m.type==='GET_RECENT_LINKS')return {ok:true,data:{links:[]}};
          if(m.type==='EXPAND_URL')return {ok:true,data:{shortUrl:'https://dri.li/AbC',target:'https://example.org/article',title:'Article title'}};
          if(m.type==='GET_STATS')return {ok:true,data:{link:{clicks:'27'}}};
          if(m.type==='LOOKUP_URL')return m.longUrl.includes('missing')?{ok:true,data:{found:false}}:{ok:true,data:{found:true,shortUrl:'https://dri.li/AbC',target:m.longUrl,title:'Article title'}};
          throw Error('Unknown message '+m.type);
        }}
      };
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>{window.__copied=s;}}});
    }''',locales)
    page.add_script_tag(content=(root/'JS/helpers.js').read_text())
    page.add_script_tag(content=(root/'JS/dashboard.js').read_text())
    page.wait_for_function('document.querySelector("#info-version").textContent === "1.10.6"')
    assert not page.locator('#helper-indicator').is_visible(),'healthy Helper must not dominate stats column'
    assert page.locator('#helper-setup').get_attribute('data-state')=='ready'
    assert not page.locator('#helper-panel').evaluate('(e)=>e.open')
    assert page.locator('#helper-panel-summary').is_visible()
    print('PASS: healthy Helper is compact, expandable when needed')
    # Short URL -> destination / title / click stats, incl scheme-less short URL.
    page.locator('#lookup-query').fill('dri.li/AbC')
    page.locator('#lookup-submit').click()
    page.locator('#lookup-long').get_by_text('https://example.org/article').wait_for()
    assert page.locator('#lookup-clicks').text_content()=='27'
    assert page.locator('#lookup-title').text_content()=='Article title'
    assert page.evaluate('window.__calls.filter(m=>m.type==="EXPAND_URL").length')==1
    page.locator('#lookup-copy').click()
    assert page.evaluate('window.__copied')=='https://dri.li/AbC'
    page.locator('#lookup-edit').click()
    assert page.locator('#manual-result').input_value()=='https://dri.li/AbC'
    assert page.locator('#manual-long').input_value()=='https://example.org/article'
    assert page.locator('#lookup-query').evaluate('(el)=>el.placeholder').startswith('https://dri.li/example')
    print('PASS: server-specific, not developer-specific, lookup placeholder')
    # All spelling variants of this installation stay on short-link lookup,
    # including http:// and a path with trailing slash and query parameters.
    for alternative in ['http://dri.li/AbC','https://dri.li/AbC/','https://dri.li/AbC?utm=test',
                        'https://dri.li/AbC/?utm=test#x']:
        page.locator('#lookup-query').fill(alternative)
        before=page.evaluate('window.__calls.length')
        page.locator('#lookup-submit').click()
        page.wait_for_function('document.querySelector("#lookup-short").textContent==="https://dri.li/AbC"')
        types=page.evaluate('(index)=>window.__calls.slice(index).map(x=>x.type)',before)
        assert 'EXPAND_URL' in types and 'LOOKUP_URL' not in types,alternative
    # Own-server URL that is not a shortlink is never treated as a destination.
    page.locator('#lookup-query').fill('https://dri.li/admin/tools.php')
    before=page.evaluate('window.__calls.length')
    page.locator('#lookup-submit').click()
    assert page.evaluate('window.__calls.length')==before
    assert not page.locator('#lookup-create').is_visible()
    assert page.locator('#lookup-message').text_content().strip()
    print('PASS: HTTP/slash/query/fragment canonicalization; no accidental own-host shortening')
    print('PASS: short URL -> destination, title, clicks, clipboard and edit')
    # Destination URL -> existing shortened link, and no match creates prefilled form.
    page.locator('#lookup-query').fill('https://example.org/article')
    page.locator('#lookup-submit').click()
    page.wait_for_function('document.querySelector("#lookup-short").textContent === "https://dri.li/AbC"')
    assert page.evaluate('window.__calls.some(m=>m.type==="LOOKUP_URL"&&m.longUrl==="https://example.org/article")')
    page.locator('#lookup-query').fill('https://example.org/missing')
    page.locator('#lookup-submit').click()
    page.locator('#lookup-create').wait_for(state='visible')
    page.locator('#lookup-create').click()
    assert page.locator('#manual-long').input_value()=='https://example.org/missing'
    assert page.locator('#manual-result').input_value()==''
    print('PASS: destination -> existing short URL and not-found Create action')
    # The displayed list filter never invokes server API.
    before=page.evaluate('window.__calls.length')
    page.locator('#filter-links').fill('abc')
    assert page.evaluate('window.__calls.length')==before
    assert page.locator('.filter-scope-help').is_visible()
    print('PASS: recent links filter explicitly local to loaded pages')
    browser.close()
