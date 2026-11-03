# 按环采样：参考关卡环位置 → 环带掩膜 ∩ 色相窗口；亮/中/暗 = 按 L 排序 85–98% / 40–60% / 3–20%
import sys,numpy as np
from PIL import Image
from skimage import color as C
RINGS=[('green',173,447),('orange',532,460),('pink',350,566),('yellow',175,665),('teal',513,663),('green2',356,786),('blue',196,901),('purple',518,915),('red',171,1111),('orange2',354,1029),('yellow2',538,1121)]
SC=540/720; R=85*SC; TUBE=14.7*SC
def load(f):
    im=np.asarray(Image.open(f).convert('RGB').resize((540,960)))/255.
    return C.rgb2lab(im),C.rgb2hsv(im)
yy,xx=np.mgrid[0:960,0:540]
def hd(h,c): d=np.abs(h-c); return np.minimum(d,1-d)
def stats(f,hues=None):
    lab,hsv=load(f);out={};hs={}
    for n,x,y in RINGS:
        d=np.hypot(xx-x*SC,yy-y*SC); ann=np.abs(d-R)<TUBE*0.9
        m=ann&(hsv[...,1]>0.3)&(hsv[...,2]>0.2)
        if hues is None:
            if m.sum()<150: out[n]=None; continue
            hc=np.angle(np.mean(np.exp(2j*np.pi*hsv[...,0][m])))/(2*np.pi)%1
        else:
            if n not in hues: out[n]=None; continue
            hc=hues[n]
        m=m&(hd(hsv[...,0],hc)<0.045); hs[n]=hc
        if m.sum()<100: out[n]=None; continue
        L=lab[m]; o=np.argsort(L[:,0]); k=len(o)
        out[n]={q:L[o[int(k*a):int(k*b)]].mean(0) for q,(a,b) in {'lit':(0.85,0.98),'mid':(0.4,0.6),'shadow':(0.03,0.2)}.items()}
    return out,hs
def hexl(l): return '#%02x%02x%02x'%tuple((np.clip(C.lab2rgb(np.array(l)[None,None])[0,0],0,1)*255).round().astype(int))
EXCL={'full6.png':{'green'},'full10.png':{'green','orange','green2','purple','yellow2'}}  # 已取下的环位（只剩扣子）/ 参考里正被笔拖动或遮挡的环
def compare(rf,tf):
    r,hs=stats(rf); [r.__setitem__(k,None) for k in EXCL.get(rf.split('/')[-1],())]; t,_=stats(tf,{k:v for k,v in hs.items() if r.get(k)}); rows=[]
    for n,_,_ in RINGS:
        if not r.get(n) or not t.get(n): continue
        for q in ('lit','mid','shadow'): rows.append((n,q,hexl(r[n][q]),hexl(t[n][q]),float(C.deltaE_ciede2000(r[n][q],t[n][q])),r[n][q],t[n][q]))
    return rows
if __name__=='__main__':
    allr=[]
    for rf,tf in zip(sys.argv[1::2],sys.argv[2::2]):
        rows=compare(rf,tf); allr+=rows
        print(f'\n### {rf.split("/")[-1]} vs {tf.split("/")[-1]}\n| 环 | 区域 | 参考 | 工具 | ΔE2000 | ΔL |\n|---|---|---|---|---|---|')
        for n,q,a,b,d,lr,lt in rows: print(f'| {n} | {q} | {a} | {b} | {d:.1f} | {lt[0]-lr[0]:+.1f} |')
    d=[x[4] for x in allr]; print(f'\n**mean ΔE {np.mean(d):.2f}, max {np.max(d):.2f}, >6: {sum(x>6 for x in d)}/{len(d)}**')
