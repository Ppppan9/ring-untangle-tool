import sys,numpy as np
from PIL import Image
from skimage import color as C
def load(f):
    im=np.asarray(Image.open(f).convert('RGB').resize((540,960)))/255.
    return im,C.rgb2lab(im),C.rgb2hsv(im)
HUES={'pink':(0.94,0.03),'orange':(0.03,0.075),'yellow':(0.075,0.16),'green':(0.2,0.42),'blue':(0.58,0.7),'purple':(0.75,0.88)}
def stats(f,M=None):
    im,lab,hsv=load(f);out={};masks={}
    h,s,v=hsv[...,0],hsv[...,1],hsv[...,2]
    for k,(a,b) in HUES.items():
        m=((h>=a)&(h<b) if a<b else ((h>=a)|(h<b)))&(s>0.35)&(v>0.25)
        m[:90]=False
        if M is not None: m=m&M[k]
        masks[k]=m
        L=lab[m]
        if len(L)<50: out[k]=None;continue
        o=np.argsort(L[:,0]);n=len(o)
        out[k]={q:L[o[int(n*p)-0]] .tolist() if False else L[o[int(n*lo):int(n*hi)]].mean(0) for q,(lo,hi) in {'shadow':(0.03,0.2),'mid':(0.4,0.6),'lit':(0.85,0.98)}.items()}
    return out,masks
from scipy.ndimage import binary_erosion as E
r,mk=stats(sys.argv[1]);from scipy.ndimage import binary_dilation as D;mk={k:D(v,iterations=12) for k,v in mk.items()};t,_=stats(sys.argv[2],mk)
def hexl(l): return '#%02x%02x%02x'%tuple((np.clip(C.lab2rgb(l[None,None])[0,0],0,1)*255).astype(int))
print('| 环 | 区域 | 参考 | 工具 | ΔE2000 |\n|---|---|---|---|---|');tot=[]
for k in HUES:
    if not r[k] or not t[k]: print('|',k,'| missing |');continue
    for q in ('lit','mid','shadow'):
        d=C.deltaE_ciede2000(r[k][q],t[k][q]);tot.append(d)
        print(f'| {k} | {q} | {hexl(r[k][q])} | {hexl(t[k][q])} | {d:.1f} |')
print('mean ΔE',np.mean(tot),'max',np.max(tot))
