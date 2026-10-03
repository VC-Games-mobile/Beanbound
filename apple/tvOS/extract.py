"""Keep the native build's game logic and menu content in sync with index.html."""
from pathlib import Path
from html.parser import HTMLParser
import json, re
root = Path(__file__).resolve().parent
html = (root.parent / 'index.html').read_text()
class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.nodes=[]; self.stack=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); n={'tag':tag,'attrs':a,'children':[],'text':''}
        if self.stack: self.stack[-1]['children'].append(n)
        else: self.nodes.append(n)
        if tag not in ('img','meta','link','br','input','hr','source'): self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag: del self.stack[i:]; break
    def handle_data(self,data):
        if self.stack and self.stack[-1]['tag'] not in ('script','style'): self.stack[-1]['text']+=data
p=Parser(); p.feed(html)
(root/'Beanbound/Resources/dom.json').write_text(json.dumps(p.nodes))
script = re.search(r'<script>(.*?)</script>', html, re.S).group(1)
# The browser engine is unchanged; expose only its native host boundary.
script=script.replace('  requestAnimationFrame(frame);\n})();', '''  globalThis.beanbound = {
    snapshot: () => ({state, score, water, best, maxM, playerX: P.x, layer: LAYERS[layer].name,
      ability: ability ? abilityLabel(ability) : '', muted,
      overlay: topOverlay() ? topOverlay().id : '',
      splash: !isHidden(splashEl), countdown: countEl.textContent,
      evolutions: EVOS.map(e => ({name: e.name, m: e.m, desc: e.desc, unlocked: maxM >= e.m}))}),
    back: remoteBack, pause: togglePauseKey,
    select: () => { if (!isHidden(splashEl)) skipDeveloperSplash(); else if (state === 'intro') skipIntro(); },
    background: () => { keys.l = keys.r = false; padX = 0; pauseGame(); },
    steering: x => { globalThis.nativeAxis = x; }
  };
  requestAnimationFrame(frame);
})();''')
# The browser paints every tiny stalk segment three times. Batch adjacent segments
# with similar widths into continuous paths for the native software rasterizer.
start = script.index('    ctx.lineCap = \'round\'; ctx.lineJoin = \'round\';', script.index('  function drawStalk(tm)'))
end = script.index('\n  }', start)
script = script[:start] + """    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? INK : pass === 1 ? '#4CC27F' : 'rgba(190,255,215,.55)';
      let width = -1, active = false;
      for (const q of segs) {
        const w = Math.round(q.w / 0.75) * 0.75;
        const offset = pass === 2 ? -w * 0.2 : 0;
        if (w !== width) {
          if (active) ctx.stroke();
          ctx.beginPath(); ctx.moveTo(q.sx + offset, q.sy);
          ctx.lineWidth = pass === 0 ? w + 4.5 : pass === 1 ? w : Math.max(1.2, w * 0.2);
          width = w; active = true;
        }
        ctx.quadraticCurveTo(q.cx + offset, q.cy, q.ex + offset, q.ey);
      }
      if (active) ctx.stroke();
    }""" + script[end:]
# Walls and boulders have static artwork. Cache their exact vector drawing as
# sprites; collision geometry and game logic are untouched.
for name in ['drawWall', 'drawBoulder']:
    script=script.replace('  function '+name+'(o) {', '  function '+name+'Content(o) {',1)
script=script.replace('  function drawWallContent(o) {', """  function drawWall(o) {
    if (!ctx.nativeSprite) return drawWallContent(o);
    const x = viewL - 100, y = o.y - 60, w = viewR - viewL + 200;
    ctx.nativeSprite('wall-'+o.seed+'-'+W, x, y, w, 120, () => drawWallContent(o));
  }
  function drawWallContent(o) {""",1)
script=script.replace('  function drawBoulderContent(o) {', """  function drawBoulder(o) {
    if (!ctx.nativeSprite) return drawBoulderContent(o);
    const r = o.r + 12;
    ctx.nativeSprite('boulder-'+o.seed+'-'+W, o.x-r, o.y-r, r*2, r*2, () => drawBoulderContent(o));
  }
  function drawBoulderContent(o) {""",1)
(root/'Beanbound/Resources/game.js').write_text(script)
