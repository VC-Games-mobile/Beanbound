"""Convert the original embedded WOFF2 fonts to native OpenType resources.
Requires fonttools[woff]; generated TTF files are bundled in the project.
"""
from pathlib import Path
import re,base64,io
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parent
html=(root.parent/'index.html').read_text()
for block in re.findall(r'@font-face\s*\{(.*?)\}',html,re.S):
    family=re.search(r"font-family:\s*'([^']+)'",block).group(1)
    weight=re.search(r'font-weight:\s*(\d+)',block).group(1)
    data=re.search(r'base64,([^\)]+)',block).group(1)
    font=TTFont(io.BytesIO(base64.b64decode(data)));font.flavor=None
    path=root/'Beanbound/Resources'/f'{family.replace(" ", "")}-{weight}.ttf'
    font.save(path)
    print(path.name, font['name'].getDebugName(6))
