import re
import pathlib

root = pathlib.Path('mobile/web/src')
texts = set()
for p in list(root.rglob('*.vue')) + list(root.rglob('*.ts')):
    s = p.read_text(encoding='utf-8')
    for m in re.findall(r"""['"`]([^'"`\n]*[\u4e00-\u9fff][^'"`\n]*)['"`]""", s):
        if len(m) < 120:
            texts.add(m.strip())
    for m in re.findall(r'>([^<>\n]*[\u4e00-\u9fff][^<>\n]*)<', s):
        if len(m) < 120:
            texts.add(re.sub(r'\s+', ' ', m).strip())
for x in sorted(texts, key=lambda x: (len(x), x)):
    print(x)
print('COUNT', len(texts))
