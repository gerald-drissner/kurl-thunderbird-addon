"""Browser-engine confirmation that clicked macOS links, not old caret, are rewritten."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
s=(root/'JS/background.js').read_text()
func=s[s.index('function performComposeInsertion('):s.index('async function insertUrl(')]
with sync_playwright() as play:
    browser=play.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
    page=browser.new_page()
    page.set_content('<section contenteditable="true" id="editor"></section>')
    page.add_script_tag(content=func)
    tasks=[
        ('macOS Control-click with caret elsewhere',
         'Start <a href="https://example.org/article">https://example.org/article</a> end',
         'Start <a href="https://sho.rt/Q">https://sho.rt/Q</a> end',True),
        ('custom link text preserved',
         'Start <a href="https://example.org/article">Unser Artikel</a> end',
         'Start <a href="https://sho.rt/Q">Unser Artikel</a> end',True),
        ('duplicate targets safely refused',
         'Start <a href="https://example.org/article">One</a> and <a href="https://example.org/article">Two</a>',
         'Start <a href="https://example.org/article">One</a> and <a href="https://example.org/article">Two</a>',False),
        ('unrelated link remains unchanged',
         '<a href="https://unrelated.example/">Other</a> <a href="https://example.org/article">Wanted</a>',
         '<a href="https://unrelated.example/">Other</a> <a href="https://sho.rt/Q">Wanted</a>',True)
    ]
    for name,html,expected,should_succeed in tasks:
        page.evaluate('html => {const e=document.querySelector("#editor");e.innerHTML=html;const r=document.createRange();r.setStart(e.firstChild,0);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r)}',html)
        result=page.evaluate('() => performComposeInsertion("https://sho.rt/Q", "https://example.org/article", false, true)')
        actual=page.locator('#editor').inner_html()
        good=(bool(result.get('ok')) == should_succeed and actual.replace('&nbsp;', ' ')==expected)
        print(name, 'PASS' if good else 'FAIL',result,repr(actual))
        assert good,name
    browser.close()
print('macOS Control-click browser cases: 4/4 PASS')
