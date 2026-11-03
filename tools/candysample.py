# 糖果风格逐字母采样：参考内容区(16..429, 4..739) 与 渲染图 统一到 413×735；按字母 bbox ∩ 色相窗口取 亮/中/暗 Lab，输出 ΔE2000 与 bbox
import sys, numpy as np
from PIL import Image, ImageDraw
from skimage import color as C
REF = '/workspace/ring-ref/style_candy.png'
LET = {'A': ((140, 225, 285, 365), 0.535), 'C': ((80, 370, 205, 505), 0.075), 'K': ((240, 380, 350, 518), 0.77), 'E': ((95, 520, 200, 662), 0.12)}
def load(f, ref=False):
    im = Image.open(f).convert('RGB'); im = im.crop((16, 4, 429, 739)) if ref else im.resize((413, 735)); return np.asarray(im) / 255.
def hd(h, c): d = np.abs(h - c); return np.minimum(d, 1 - d)
def stats(a):
    lab, hsv = C.rgb2lab(a), C.rgb2hsv(a); out = {}
    for n, ((x0, y0, x1, y1), hc) in LET.items():
        m = np.zeros(a.shape[:2], bool); m[y0:y1, x0:x1] = True; m &= (hd(hsv[..., 0], hc) < 0.04) & (hsv[..., 1] > 0.35) & (hsv[..., 2] > 0.25)
        ys, xs = np.where(m); L = lab[m]; o = np.argsort(L[:, 0]); k = len(o)
        out[n] = dict(bbox=(xs.min(), ys.min(), xs.max(), ys.max()), n=k, **{q: L[o[int(k * u):int(k * v)]].mean(0) for q, (u, v) in {'lit': (0.85, 0.98), 'mid': (0.4, 0.6), 'shadow': (0.03, 0.2)}.items()})
    return out
def hexl(l): return '#%02x%02x%02x' % tuple((np.clip(C.lab2rgb(np.array(l)[None, None])[0, 0], 0, 1) * 255).round().astype(int))
if __name__ == '__main__':
    R, T = stats(load(REF, True)), stats(load(sys.argv[1])); tot = []
    for n in LET:
        r, t = R[n], T[n]; row = []
        for q in ('lit', 'mid', 'shadow'): d = C.deltaE_ciede2000(r[q][None], t[q][None])[0]; tot.append(d); row.append(f'{q} {hexl(r[q])}/{hexl(t[q])} ΔE {d:.1f}')
        print(n, 'bbox ref', r['bbox'], 'ours', t['bbox'], 'px', r['n'], t['n'], ' | '.join(row))
    print('mean ΔE %.2f max %.2f' % (np.mean(tot), np.max(tot)))
    if len(sys.argv) > 2:
        a, b = Image.open(REF).convert('RGB').crop((16, 4, 429, 739)), Image.open(sys.argv[1]).convert('RGB').resize((413, 735))
        o = Image.new('RGB', (413 * 3 + 20, 735), 'white'); o.paste(a, (0, 0)); o.paste(b, (423, 0)); o.paste(Image.blend(a, b, 0.5), (846 + 10, 0)); o.save(sys.argv[2])
