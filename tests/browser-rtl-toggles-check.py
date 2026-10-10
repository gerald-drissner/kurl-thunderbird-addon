"""Browser-level check of actual toggle geometry in LTR/RTL on and off."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
css=(root/'styles.css').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':800,'height':600})
 for lang in ('en','ar','he'):
  direction='rtl' if lang in ('ar','he') else 'ltr'
  html=f'<html lang="{lang}" dir="{direction}"><style>{css}</style><body><label class="switch"><input id="switch" type="checkbox"><span class="slider round"></span></label></body></html>'
  page.set_content(html)
  for on in (False,True):
   page.locator('#switch').evaluate('(el,on) => el.checked = on',on)
   # Test final resting position, not the animated intermediate transition.
   page.wait_for_timeout(470)
   box=page.locator('.slider').evaluate('el => {const a=el.getBoundingClientRect(); const st=getComputedStyle(el,"::before"); const x=parseFloat(st.left) + a.left + new DOMMatrix(st.transform).m41; return {left:a.left, right:a.right, x, xright:x+18, knobColor:st.backgroundColor, transform:st.transform}}')
   assert box['x'] >= box['left']+1 and box['xright'] <= box['right']-1,(lang,on,box)
   if direction=='rtl':
    assert (box['x'] < box['left']+10) == on, (lang,on,box)
   else:
    assert (box['x'] > box['left']+10) == on, (lang,on,box)
   print(lang,'ON' if on else 'OFF', 'PASS',round(box['x']-box['left'],1))
 browser.close()
print('RTL/LTR real browser switch geometry: 6/6 PASS')
