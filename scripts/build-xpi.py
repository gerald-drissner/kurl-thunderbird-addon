#!/usr/bin/env python3
"""Create and verify kURL XPI with only runtime assets. No network required."""
from pathlib import Path
import json,zipfile,re,sys,hashlib
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'manifest.json').read_text())
version=manifest['version']
out=Path(sys.argv[1]) if len(sys.argv)>1 else root/f'kurl-thunderbird-{version}-test.xpi'
allowed={'manifest.json','options.html','popup.html','dashboard.html','bulk.html','logs.html','styles.css','VENDOR.md'}
folders={'JS','images','_locales','helper'}
files=sorted(q for q in root.rglob('*') if q.is_file() and (q.relative_to(root).as_posix() in allowed or q.relative_to(root).parts[0] in folders))
# Do not copy filesystem timestamps or platform-dependent permission bits into the
# archive. Otherwise two builds from identical source yield different XPI hashes.
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for file in files:
        info=zipfile.ZipInfo(file.relative_to(root).as_posix(),date_time=(1980,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.create_system=3
        info.external_attr=(0o100644 << 16)
        z.writestr(info,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    names=set(z.namelist())
    assert z.read('manifest.json')
    assert 'VENDOR.md' in names and 'JS/qrcode.js' in names
    assert 'helper/kurl-helper/plugin.php' in names
    assert z.read('helper/kurl-helper/plugin.php').startswith(b'<?php\n/*\nPlugin Name: kURL Helper\n')
    assert not any(name.startswith(('tests/','scripts/')) or name in {'REVIEWER_NOTES.md','README.md','package.json'} for name in names)
    m=json.loads(z.read('manifest.json'))
    assert m['version']==version and m['manifest_version']==3
    assert all('suggested_key' not in cmd for cmd in m.get('commands',{}).values())
    for html in (name for name in names if name.endswith('.html')):
        contents=z.read(html).decode('utf-8')
        for script in re.findall(r'<script[^>]+src="([^"]+)"',contents):assert script in names,(html,script)
    for icon in m.get('icons',{}).values():assert icon in names
    for loc in (name for name in names if name.endswith('messages.json')):
        messages=json.loads(z.read(loc))
        for entry in messages.values():
            assert entry.get('message')
            if '$shortcut$' in entry['message']:
                assert entry.get('placeholders',{}).get('shortcut',{}).get('content')=='$1'
print(f'PASS: {out} — {len(files)} files, {out.stat().st_size} bytes')
print('SHA256:',hashlib.sha256(out.read_bytes()).hexdigest())
