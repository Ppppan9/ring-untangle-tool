# 逐字母剪影 IoU：参考 vs 渲染（450×745 参考坐标；去掉扣子/杆：只取字母主色相 + 高饱和 + 形态开运算）
import sys, numpy as np
from PIL import Image
from skimage import color as C, morphology as M
LET = {'A': ((120, 225, 300, 380), 0.535), 'C': ((70, 365, 215, 515), 0.075), 'K': ((235, 375, 360, 525), 0.77), 'E': ((80, 515, 215, 665), 0.12)}
def load(f, ref):
    im = Image.open(f).convert('RGB')
    if ref: return np.asarray(im) / 255.
    o = Image.new('RGB', (450, 745)); o.paste(im.resize((413, 735)), (16, 4)); return np.asarray(o) / 255.
def mask(a, box, hc):
    hsv = C.rgb2hsv(a); d = np.abs(hsv[..., 0] - hc); d = np.minimum(d, 1 - d); m = (d < 0.07) & (hsv[..., 1] > 0.3) & (hsv[..., 2] > 0.3)
    x0, y0, x1, y1 = box; k = np.zeros_like(m); k[y0:y1, x0:x1] = m[y0:y1, x0:x1]; k = M.closing(k, M.disk(3)).astype(bool); return M.opening(k, M.disk(3)).astype(bool)
R, T = load('/workspace/ring-ref/style_candy.png', True), load(sys.argv[1], False); out = []
for n, (box, hc) in LET.items():
    a, b = mask(R, box, hc), mask(T, box, hc); iou = (a & b).sum() / max(1, (a | b).sum()); out.append(iou)
    ya, xa = np.where(a); yb, xb = np.where(b); print(n, 'IoU %.3f' % iou, 'ref bbox', (xa.min(), ya.min(), xa.max(), ya.max()), 'ours', (xb.min(), yb.min(), xb.max(), yb.max()), 'area', a.sum(), b.sum())
print('mean IoU %.3f' % np.mean(out))
if len(sys.argv) > 2:
    o = np.zeros((745, 450, 3)); 
    for n, (box, hc) in LET.items(): o[..., 0] += mask(R, box, hc); o[..., 1] += mask(T, box, hc)
    Image.fromarray((np.clip(o, 0, 1) * 255).astype('uint8')).save(sys.argv[2])
