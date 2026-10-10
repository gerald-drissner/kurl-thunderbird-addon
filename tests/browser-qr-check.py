from pathlib import Path
from playwright.sync_api import sync_playwright
from base64 import b64decode
import numpy as np
import cv2
p=Path(__file__).resolve().parent.parent
source=(p/'JS/popup.js').read_text()
render=source[source.index('  function renderQr(target, value, size) {'):source.index('  function clearResults() {')]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
    page=browser.new_page()
    page.set_content('<div id="holder"></div>')
    page.add_script_tag(path=str(p/'JS/qrcode.js'))
    page.add_script_tag(content=render)
    for url in ['https://sho.rt/aB6','https://sho.rt/Ägypten','https://sho.rt/عَرَبِيّ']:
        encoded=page.evaluate('value => renderQr(document.getElementById("holder"), value, 512).toDataURL("image/png")',url)
        img=cv2.imdecode(np.frombuffer(b64decode(encoded.split(',')[1]),np.uint8),cv2.IMREAD_GRAYSCALE)
        decoded,points,_=cv2.QRCodeDetector().detectAndDecode(img)
        assert img.shape==(512,512),img.shape
        assert np.all(img[0,:]==255) and np.all(img[:,0]==255)
        from urllib.parse import quote
        from urllib.parse import urlsplit, urlunsplit
        parts=urlsplit(url)
        normalized=urlunsplit((parts.scheme,parts.netloc.encode('idna').decode(),quote(parts.path,safe='/%:@!$&\'()*+,;=-._~'),quote(parts.query,safe='/%:@!$&\'()*+,;=?-._~'),quote(parts.fragment,safe='/%:@!$&\'()*+,;=?-._~')))
        assert decoded==normalized,(url,decoded,normalized)
        print('PASS: QR decoded, 512x512 with white border:',decoded)
    browser.close()
