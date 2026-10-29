"""Bundle the main and Challenge games with native lifecycle and touch adaptations."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent
def prepare(html):
    html=html.replace('1.0.8', '1.2.0').replace('Beanbound TV', 'Beanbound')
    html=html.replace("sign(leftX, '#566B9C', 'GO TO THE', 'MOON');", "sign(leftX, '#566B9C', 'PLAY AGAIN', 'NEW CLIMB');")
    html=html.replace('      showMoonComingSoon();\n      return;', '      startGame();\n      return;')
    html=html.replace("'Congratulations, you made it!', vw / 2", "'You reached space!', vw / 2")
    html=html.replace('ctx.font = "42px \'Bagel Fat One\', \'Trebuchet MS\', sans-serif";', 'ctx.font = `${Math.min(42, vw / 13)}px \'Bagel Fat One\', \'Trebuchet MS\', sans-serif`;')
    html=html.replace('MOON COMING SOON!', 'You reached space!').replace("The Moon isn't ready yet.", 'Your climb is complete. Try again to improve your best score.')
    html=html.replace('<button id="aboutBack"', '<a class="btn alt" style="display:block;text-decoration:none" href="https://vc-games-mobile.github.io/Beanbound/privacy.html">Privacy policy</a><a class="btn alt" style="display:block;text-decoration:none" href="https://vc-games-mobile.github.io/Beanbound/support.html">Help &amp; support</a><a class="btn alt" style="display:block;text-decoration:none" href="credits.html">Credits &amp; font licenses</a><button id="aboutBack"')
    html=html.replace('let tvMode = true;', 'let tvMode = false;').replace('this is the Apple TV build: TV mode is always on', 'iPhone and iPad use the original touch layout')
    # Restore scrolling for long touch menus, while the canvas keeps drag steering.
    html=html.replace('</style>', '''
      body { touch-action: manipulation; }
      .overlay { touch-action: pan-y; -webkit-overflow-scrolling: touch; }
      .overlay > .card { flex-shrink: 0; margin-top: auto; margin-bottom: auto; }
      .menuscreen { gap: 24px; }
      .mtop, .mbottom { flex-shrink: 0; }
      @media (orientation: landscape) and (max-height: 520px) {
        .overlay:not(.menuscreen) { align-items: flex-start; }
        .mtop, .mbottom { width: calc(50% - 12px); }
      }
    </style>''')
    html=html.replace('Beanbound updates automatically, so you normally don’t need to manually update the game.', 'New versions of Beanbound are available through the App Store.')
    html=html.replace('You only need to manually update for big events or special releases.', 'Your progress and settings stay saved on this device when the app is updated.')
    marker='  requestAnimationFrame(frame);\n})();'
    assert html.count(marker)==1
    html=html.replace(marker,'''  // Native lifecycle stops input and audio while the app is inactive.
      window.beanboundNative = {
        background() { keys.l = keys.r = false; ptr = null; if(typeof padX!=='undefined')padX=0; pauseGame(); if (AC) AC.suspend(); const f=document.getElementById('challengeFrame'); if(f&&!f.hidden)f.contentWindow.beanboundNative?.background(); },
        foreground() { const f=document.getElementById('challengeFrame'); if(f&&!f.hidden)f.contentWindow.beanboundNative?.foreground(); else if (AC) AC.resume(); },
        snapshot() { return {state, endless, endlessLoop, endlessBest, score, best, maxM, muted, playerX:P.x, audio:AC ? AC.state : 'uninitialized', challenge:!!document.getElementById('challengeFrame')&&!document.getElementById('challengeFrame').hidden}; }
      };
      requestAnimationFrame(frame);
    })();''')
    return html
challenge = prepare((root.parent/'challenge.html').read_text())
(root/'Beanbound/Resources/challenge.html').write_text(challenge)
main = prepare((root.parent/'index.html').read_text())
# srcdoc inherits the main frame origin so the bundled mode can share native saves.
payload = json.dumps(challenge, ensure_ascii=True).replace('<', r'\u003c')
main = main.replace('</body>', '<script type="application/json" id="challengeSrc">' + payload + '</script></body>')
(root/'Beanbound/Resources/index.html').write_text(main)
