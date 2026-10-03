"""Bundle the shared original game with the iOS lifecycle boundary."""
from pathlib import Path
root=Path(__file__).resolve().parent
html=(root.parent/'index.html').read_text()
assert 'let tvMode = true;' in html
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
html=html.replace('Beanbound updates automatically, so you normally don’t need to manually update the game.', 'Install new versions of Beanbound through the App Store, TestFlight, or Xcode, depending on how you installed this app.')
html=html.replace('You only need to manually update for big events or special releases.', 'Your progress and settings stay saved on this device when the app is updated.')
marker='  requestAnimationFrame(frame);\n})();'
assert html.count(marker)==1
html=html.replace(marker,'''  // Native lifecycle stops input and audio while the app is inactive.
  window.beanboundNative = {
    background() { keys.l = keys.r = false; ptr = null; padX = 0; pauseGame(); if (AC) AC.suspend(); },
    foreground() { if (AC) AC.resume(); },
    snapshot() { return {state, score, best, maxM, muted, playerX:P.x, audio:AC ? AC.state : 'uninitialized'}; }
  };
  requestAnimationFrame(frame);
})();''')
(root/'Beanbound/Resources/index.html').write_text(html)
# Same original icon artwork, adapted to a square canvas by make_icon.swift.
