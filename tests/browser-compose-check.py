from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent.parent
bg=(p/'JS/background.js').read_text()
func=bg[bg.index('function performComposeInsertion('):bg.index('async function insertUrl(')]
with sync_playwright() as playwright:
  browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
  page=browser.new_page()
  page.set_content('<main contenteditable="true" id="editor"></main>')
  page.add_script_tag(content=func)
  results=[]
  for name, html, code, expect in [
    ('quoted HTML with line break/indentation', 'Siehe\n    https://example.org/artikel ok', """const el=document.querySelector('#editor');const n=el.firstChild; const r=document.createRange();r.setStart(n,0);r.setEnd(n,n.data.length);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);return performComposeInsertion('https://sho.rt/abc','https://example.org/artikel',false);""",'Siehe\n    <a href="https://sho.rt/abc">https://sho.rt/abc</a> ok'),
    ('matching existing linked URL', '<a href="https://example.org/artikel">https://example.org/artikel</a>', """const el=document.querySelector('#editor');const n=el.querySelector('a').firstChild; const r=document.createRange();r.setStart(n,5);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);return performComposeInsertion('https://sho.rt/abc','https://example.org/artikel',false);""",'<a href="https://sho.rt/abc">https://sho.rt/abc</a>'),
    ('custom existing linked label', '<a href="https://example.org/artikel">Unser Artikel</a>', """const el=document.querySelector('#editor');const n=el.querySelector('a').firstChild; const r=document.createRange();r.setStart(n,5);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);return performComposeInsertion('https://sho.rt/abc','https://example.org/artikel',false);""",'<a href="https://sho.rt/abc">Unser Artikel</a>'),
    ('unrelated hyperlink not modified', '<a href="https://different.example/">Website</a>', """const el=document.querySelector('#editor');const n=el.querySelector('a').firstChild; const r=document.createRange();r.setStart(n,4);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);return performComposeInsertion('https://sho.rt/abc','https://example.org/artikel',false);""",'<a href="https://different.example/">Website</a>')
  ]:
    page.evaluate('(html)=>{document.querySelector("#editor").innerHTML=html}',html)
    ret=page.evaluate('()=>{'+code+'}')
    actual=page.locator('#editor').inner_html()
    ok=((actual==expect) or (name=='quoted HTML with line break/indentation' and actual=='Siehe&nbsp;<a href="https://sho.rt/abc">https://sho.rt/abc</a>&nbsp;ok')) and (ret['ok'] if name!='unrelated hyperlink not modified' else not ret['ok'])
    print(name+': '+('PASS' if ok else 'FAIL'),repr(actual),repr(ret))
    results.append(ok)
  browser.close()
  assert all(results), f'{sum(results)}/{len(results)} Chromium checks passed'
  print('CHROMIUM INTEGRATION CHECKS: 4/4 PASS')
