<?php
/* Isolated, non-destructive address validation for the bundled Helper. */
define('YOURLS_ABSPATH', '/fake/');
function yourls_add_filter($name, $fn) {}
function yourls_link($keyword) { return $GLOBALS['yourls_link_for_test']; }
function yourls_sanitize_keyword($keyword, $strict = true) {return $keyword;}
require __DIR__.'/../helper/kurl-helper/plugin.php';
$cases = [
 ['http://sho.rt/abc','http://sho.rt/abc',true],
 ['http://sho.rt/abc','https://sho.rt/abc',true],
 ['https://sho.rt/abc','https://sho.rt/abc',true],
 ['https://sho.rt/abc','http://sho.rt/abc',false],
 ['http://sho.rt/abc','https://evil.org/abc',false],
 ['http://sho.rt/abc','https://sho.rt/other',false],
 ['http://sho.rt:8080/abc','https://sho.rt/abc',false],
 ['http://sho.rt/abc','https://sho.rt:8443/abc',false],
 ['http://sho.rt/abc','https://sho.rt/abc?query=1',false],
 ['http://sho.rt/abc','https://alice:secret@sho.rt/abc',false],
];
foreach ($cases as [$canonical,$given,$expected]) {
 $GLOBALS['yourls_link_for_test']=$canonical;
 $actual=kurl_api_shorturl_belongs_to_installation($given, 'abc');
 if ($actual !== $expected) {fwrite(STDERR,"FAILED: canonical=$canonical given=$given result=".var_export($actual,true)." expected=".var_export($expected,true)."\n");exit(1);}
}
echo 'PHP Helper same-site HTTPS upgrade cases: '.count($cases).'/'.count($cases).' PASS'.PHP_EOL;
