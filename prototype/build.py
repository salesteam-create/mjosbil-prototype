"""Bundle the prototype into one self-contained HTML file: dist/mjosbil-prototype.html"""
import base64, pathlib, re
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf8')
html = html.replace('<link rel="stylesheet" href="assets/styles.css">', '<style>\n' + (root / 'assets/styles.css').read_text(encoding='utf8') + '</style>')
for name in ['icons', 'data', 'i18n', 'app']:
    js = (root / f'assets/{name}.js').read_text(encoding='utf8')
    html = html.replace(f'<script src="assets/{name}.js"></script>', '<script>\n' + js + '</script>')
mime = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}
def inline(m):
    f = root / m.group(0)
    return f'data:{mime[f.suffix]};base64,' + base64.b64encode(f.read_bytes()).decode()
html = re.sub(r'assets/img/[\w.-]+\.(?:jpe?g|png)', inline, html)
out = root / 'dist' / 'mjosbil-prototype.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf8')
print(out, f'{len(html) / 1e6:.2f} MB')

# GitHub Pages serves /docs on the repo's default branch.
docs = root.parent / 'docs'
docs.mkdir(exist_ok=True)
(docs / 'index.html').write_text(html, encoding='utf8')
(docs / '.nojekyll').write_text('', encoding='utf8')
print(docs / 'index.html')
