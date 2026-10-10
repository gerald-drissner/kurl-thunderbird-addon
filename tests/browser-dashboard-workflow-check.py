"""2.0.19 browser checks: onboarding, localized delete, concurrent refresh and status lamp."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'manifest.json').read_text())
assert manifest['options_ui']['page']=='dashboard.html'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page()
    page.set_default_timeout(5000)
    page.set_content((root/'dashboard.html').read_text())
    page.add_style_tag(content=(root/'styles.css').read_text())
    page.evaluate('''() => {
      window.__saved={yourlsUrl:'',apiSignature:'',autoCopy:true,showCopyNotifications:true};
      window.__calls=[];
      window.__helper=true;
      window.__deleted=false;
      window.__holdDelete=false;window.__pendingDeleteResolve=null;
      window.__confirmMessages=[];
      window.confirm=message=>{window.__confirmMessages.push(message);return true;};
      window.browser={
        i18n:{getUILanguage:()=>'en-US',getMessage:()=>''},
        storage:{local:{get:async defaults=>({...defaults,...window.__saved}),set:async data=>Object.assign(window.__saved,data)},onChanged:{addListener:()=>{}}},
        runtime:{getURL:path=>'moz-extension://kurl/'+path,sendMessage:async request=>{
          window.__calls.push(request);
          if(request.type==='GET_INFO')return {ok:true,data:{base:'https://sho.rt',totalLinks:8,totalClicks:20,helperReady:window.__helper,helperVersion:window.__helper?'1.1.7':'',yourlsVersion:'1.10.6'}};
          if(request.type==='GET_LOG')return {ok:true,data:[]};
          if(request.type==='GET_TOP_LINKS'||request.type==='GET_RECENT_LINKS')return {ok:true,data:{links:[]}};
          if(request.type==='EXPAND_URL')return {ok:true,data:{shortUrl:'https://sho.rt/abc',target:'https://example.org/page',title:'Sample'}};
          if(request.type==='GET_STATS')return {ok:true,data:{link:{clicks:3}}};
          if(request.type==='DELETE_SHORTURL'){
            if(window.__holdDelete)return new Promise(resolve=>{window.__pendingDeleteResolve=()=>{window.__deleted=true;resolve({ok:true});};});
            window.__deleted=true;return {ok:true};
          }
          throw Error('Unexpected '+request.type);
        }}
      };
    }''')
    page.add_script_tag(content=(root/'JS/helpers.js').read_text())
    page.add_script_tag(content=(root/'JS/dashboard.js').read_text())
    page.wait_for_function('document.querySelector(".dashboard-shell").classList.contains("is-unconfigured")')
    assert page.locator('#dashboard-onboarding').is_visible()
    assert page.locator('.dashboard-workspace').is_hidden()
    assert page.locator('#dashboard-onboarding a').get_attribute('href')=='options.html'
    assert page.evaluate('window.__calls.length')==0
    print('PASS Dashboard is default; missing credentials show setup, no API request')
    page.evaluate("window.__saved.yourlsUrl='https://sho.rt';window.__saved.apiSignature='token'")
    page.locator('#refresh-btn').click()
    page.wait_for_function('document.querySelector("#server-status").textContent==="Online"')
    assert page.locator('#dashboard-onboarding').is_hidden()
    page.locator('#lookup-query').fill('https://sho.rt/abc')
    page.locator('#lookup-submit').click()
    page.locator('#lookup-delete').wait_for(state='visible')
    assert page.evaluate('window.__deleted') is False
    # Cancel should never send a destructive request.
    page.evaluate('window.confirm=()=>false')
    page.locator('#lookup-delete').click()
    assert page.evaluate('window.__calls.filter(c=>c.type==="DELETE_SHORTURL").length')==0
    page.evaluate('window.confirm=message=>{window.__confirmMessages.push(message);return true;}')
    page.locator('#lookup-delete').click()
    page.wait_for_function('window.__deleted===true')
    page.wait_for_function('document.querySelector("#lookup-result").hidden')
    assert page.evaluate('window.__calls.filter(c=>c.type==="DELETE_SHORTURL").length')==1
    print('PASS Delete only after explicit confirmation; clears stale result and refreshes')
    # Delayed DELETE while a search input event invalidates the old lookup generation.
    # The deletion is still committed, so both link lists MUST refresh.
    page.locator('#lookup-query').fill('https://sho.rt/abc')
    page.locator('#lookup-submit').click()
    page.locator('#lookup-delete').wait_for(state='visible')
    page.evaluate('window.__holdDelete=true')
    previous = page.evaluate('window.__calls.filter(c=>c.type==="GET_INFO").length')
    page.locator('#lookup-delete').click()
    page.wait_for_function('typeof window.__pendingDeleteResolve==="function"')
    page.locator('#lookup-query').fill('https://example.org/next')
    assert page.locator('#lookup-result').is_hidden()
    page.evaluate('window.__pendingDeleteResolve()')
    page.wait_for_function('(n)=>window.__calls.filter(c=>c.type==="GET_INFO").length>n', arg=previous)
    page.wait_for_function('(n)=>window.__calls.filter(c=>c.type==="GET_TOP_LINKS").length>=n', arg=2)
    assert page.locator('#lookup-query').input_value()=='https://example.org/next'
    assert page.locator('#lookup-result').is_hidden()
    assert page.evaluate('window.__calls.filter(c=>c.type==="DELETE_SHORTURL").length')==2
    assert page.evaluate('window.__confirmMessages.at(-1).includes("https://sho.rt/abc")')
    print('PASS Pending delete followed by typing still refreshes lists, preserves new query')
    page.evaluate('window.__holdDelete=false;window.__helper=false;window.__deleted=false')
    page.locator('#refresh-btn').click()
    page.wait_for_function('document.querySelector("#helper-setup").dataset.state==="missing"')
    page.locator('#lookup-query').fill('https://sho.rt/abc')
    page.locator('#lookup-submit').click()
    page.wait_for_function('document.querySelector("#lookup-short").textContent.includes("sho.rt")')
    assert not page.locator('#lookup-delete').is_visible()
    print('PASS Search delete is hidden when optional Helper is unavailable')
    # Settings: always a live check, rather than a stored success flag.
    pg=browser.new_page()
    pg.set_default_timeout(5000)
    pg.set_content((root/'options.html').read_text())
    pg.add_style_tag(content=(root/'styles.css').read_text())
    pg.evaluate('''() => {
      window.__saved={yourlsUrl:'https://sho.rt',apiSignature:'existing',autoCopy:true,showCopyNotifications:true};
      window.__live=true;window.__checks=0;window.__writes=[];
      window.browser={
        i18n:{getUILanguage:()=>'en-US',getMessage:()=>''},
        commands:{getAll:async()=>[]},
        permissions:{contains:async()=>true,request:async()=>true,remove:async()=>true},
        storage:{local:{get:async v=>typeof v==='string'?{[v]:window.__saved[v]}:{...v,...window.__saved},set:async data=>{window.__writes.push(data);Object.assign(window.__saved,data)}},onChanged:{addListener:()=>{}}},
        runtime:{sendMessage:async request=>{window.__checks++;return window.__live?{ok:true,total:12}:{ok:false,errorCode:'AUTH_REJECTED',reason:'Invalid signature'};}}
      };
    }''')
    pg.add_script_tag(content=(root/'JS/helpers.js').read_text())
    pg.add_script_tag(content=(root/'JS/options.js').read_text())
    pg.wait_for_function('document.querySelector("#connection-indicator").classList.contains("connection-ok")')
    assert pg.evaluate('window.__checks')==1
    assert pg.evaluate('window.__writes.length')==0
    pg.locator('#apiSignature').fill('new-token')
    assert 'connection-neutral' in pg.locator('#connection-indicator').get_attribute('class')
    pg.evaluate('window.__live=false')
    pg.locator('#test').click()
    pg.wait_for_function('document.querySelector("#connection-indicator").classList.contains("connection-bad")')
    assert pg.evaluate('window.__writes.length')==0
    pg.evaluate('window.__live=true')
    pg.locator('#test').click()
    pg.wait_for_function('document.querySelector("#connection-indicator").classList.contains("connection-ok")')
    assert pg.evaluate('window.__writes.length')==1
    pg.locator('#apiSignature').fill('another-token')
    pg.locator('#save').click()
    pg.wait_for_function('window.__writes.length===2')
    assert 'connection-neutral' in pg.locator('#connection-indicator').get_attribute('class')
    print('PASS Settings status: live check green, edits neutral, rejected test red, unchecked save neutral')
    browser.close()
