import re

p = r'mobile\web\src\i18n\auto.ts'
s = open(p, encoding='utf-8').read()
out = []
for line in s.splitlines():
    m = re.match(r"^(\s*)([^\s'\"][^:]*?):(\s*.*)$", line)
    if m and not m.group(2).startswith("'") and not m.group(2).startswith('"'):
        key = m.group(2)
        if re.search(r'[^\x00-\x7f]', key):
            line = f"{m.group(1)}'{key}':{m.group(3)}"
    out.append(line)
open(p, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('done')
