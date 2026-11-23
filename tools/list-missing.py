import re
import pathlib

root = pathlib.Path('mobile/web/src')
auto = pathlib.Path('mobile/web/src/i18n/auto.ts').read_text(encoding='utf-8')
keys = set(re.findall(r"^\s*'([^']+)':", auto, re.M))
keys |= set(re.findall(r"^\s*([^\s'\"][^:]*?):\s*'", auto, re.M))

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

missing = set()
for p in root.rglob('*.vue'):
    s = p.read_text(encoding='utf-8')
    # text nodes
    for m in re.findall(r'>([^<>\n]*[\u4e00-\u9fff][^<>\n]*)<', s):
        text = norm(m)
        if text and not text.startswith('{{') and len(text) < 150:
            missing.add(text)
    # attributes
    for m in re.findall(r'(?:placeholder|title|aria-label)="([^"]*[\u4e00-\u9fff][^"]*)"', s):
        text = norm(m)
        if text and len(text) < 150:
            missing.add(text)

missing -= keys
for x in sorted(missing, key=lambda x: (len(x), x)):
    print(x)
print('COUNT', len(missing))
