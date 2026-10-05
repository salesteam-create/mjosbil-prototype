"""Bundle the prototype into one self-contained HTML file: dist/mjosbil-prototype.html"""
import pathlib, re
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf8')
html = html.replace('<link rel="stylesheet" href="assets/styles.css">', '<style>\n' + (root / 'assets/styles.css').read_text(encoding='utf8') + '</style>')
for name in ['data', 'i18n', 'app']:
    js = (root / f'assets/{name}.js').read_text(encoding='utf8')
    html = html.replace(f'<script src="assets/{name}.js"></script>', '<script>\n' + js + '</script>')
out = root / 'dist' / 'mjosbil-prototype.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf8')
print(out, len(html))
