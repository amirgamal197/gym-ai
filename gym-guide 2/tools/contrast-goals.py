import json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT="/home/claude/proj/gym-guide"
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
class S(socketserver.ThreadingTCPServer): allow_reuse_address=True; daemon_threads=True
h=S(("127.0.0.1",0),functools.partial(Q,directory=ROOT)); B=f"http://127.0.0.1:{h.server_address[1]}/"
threading.Thread(target=h.serve_forever,daemon=True).start()
JS = r"""
(root)=>{
 const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
 const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
 const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
 const bgOf=el=>{const layers=[];for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);const c=parse(cs.backgroundColor);if(c&&c.a>0)layers.push(c);if(cs.backgroundImage&&cs.backgroundImage!=='none'){const g=[...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m=>parse(m[0]));if(g.length){layers.push(g.reduce((w,x)=>lum(x)>lum(w)?x:w));break;}}if(c&&c.a===1)break;}
   let base={r:10,g:11,b:14,a:1};for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return base;};
 const out=[];const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(w.nextNode()){const n=w.currentNode;if(!n.textContent.trim())continue;const el=n.parentElement;const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
  const cs=getComputedStyle(el);let fg=parse(cs.color);const bg=bgOf(el);const op=parseFloat(cs.opacity);fg=over({...fg,a:fg.a*op},bg);
  const L1=lum(fg),L2=lum(bg);const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
  const px=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=700;const large=px>=24||(px>=18.66&&bold);
  out.push({t:n.textContent.trim().slice(0,28),ratio:Math.round(ratio*100)/100,need:large?3:4.5,cls:el.className});}
 return out;}
"""
res=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},service_workers="block"); pg=ctx.new_page()
    pg.goto(B); pg.wait_for_selector("#onboarding:not([hidden])")
    def sweep(label,sel):
        for r in pg.evaluate(f"(a)=>({JS})(document.querySelector(a))", sel): r["where"]=label; res.append(r)
    sweep("goal step (none selected)","#onboarding")
    pg.click('[data-action="ob-select"][data-value="strength"]'); sweep("goal step (selected)","#onboarding")
    pg.click('[data-action="ob-next"]'); sweep("level step","#onboarding")
    pg.click('[data-field="experience"][data-value="beginner"]'); sweep("level step (selected)","#onboarding")
    pg.click('[data-action="ob-next"]'); pg.click('[data-field="equipment"][data-value="bands"]'); sweep("equipment step","#onboarding")
    pg.click('[data-action="ob-next"]'); pg.click('[data-field="posture"][data-value="apt"]'); sweep("posture step","#onboarding")
    pg.click('[data-action="ob-next"]'); sweep("summary","#onboarding")
    pg.click('[data-action="ob-finish"]'); pg.wait_for_timeout(300)
    pg.goto(B+"#day1"); pg.wait_for_selector("#goalNote"); sweep("goal note","#goalNote")
    pg.goto(B+"#corrective"); pg.wait_for_selector(".condition-card.mine"); sweep("mine card","#mainContent")
    b.close()
bad=[r for r in res if r["ratio"]<r["need"]]
print("samples:",len(res),"min ratio:",min(r["ratio"] for r in res))
for r in bad: print("LOW",r)
print("OK" if not bad else "FAIL")
