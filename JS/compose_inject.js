
(function(){
  function getSelectionUrl(){
    const sel = window.getSelection();
    let text = sel ? String(sel).trim() : "";
    let isLink = false;
    try{
      const node = sel && sel.anchorNode ? sel.anchorNode.parentElement || sel.anchorNode : null;
      const a = node && node.closest ? node.closest('a') : null;
      if(a && a.href){ text = a.href; isLink = true; }
    }catch{}
    return { url:text, isLink };
  }
  browser.runtime.onMessage.addListener((msg)=>{
    if(msg?.type==="PING") return true;
    if(msg?.type==="GET_SELECTION_URL") return getSelectionUrl();
    if(msg?.type==="INSERT_SHORT_URL"){
      try{
        const sel = window.getSelection();
        const node = sel && sel.anchorNode ? sel.anchorNode.parentElement || sel.anchorNode : null;
        const a = node && node.closest ? node.closest('a') : null;
        const url = msg.shortUrl;
        if(msg.replaceLink && a){ a.href=url; a.textContent=url; }
        else { document.execCommand('insertText', false, url); }
        return true;
      }catch{ return false; }
    }
  });
})();
