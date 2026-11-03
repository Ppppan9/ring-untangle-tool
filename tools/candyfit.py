import subprocess, json, sys, numpy as np
sys.path.insert(0, 'tools'); from candysample import *
cols = {'A': ('candy_teal', '#00c8ff'), 'C': ('candy_orange', '#ff870f'), 'K': ('candy_purple', '#9f12f7'), 'E': ('candy_yellow', '#ffbb14')}
cur = {k: v for k, (kk, v) in cols.items()}
R = stats(load(REF, True))
def h2lab(h): return C.rgb2lab(np.array([[[int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]]]))[0, 0]
for it in range(int(sys.argv[1])):
    ex = {'letterStyle': 'candy', 'connStyle': 'clasp', 'autoMode': 'ref', **{cols[k][0]: cur[k] for k in cols}}
    subprocess.run(['node', 'test/letters.mjs', 'CAKE', '0', f'/tmp/v112/fit{it}', json.dumps(ex)], capture_output=True, timeout=300)
    T = stats(load(f'/tmp/v112/fit{it}_0.png')); ds = []
    for k in cols:
        err = (R[k]['mid'] * 0.6 + R[k]['lit'] * 0.2 + R[k]['shadow'] * 0.2) - (T[k]['mid'] * 0.6 + T[k]['lit'] * 0.2 + T[k]['shadow'] * 0.2)
        ds += [C.deltaE_ciede2000(R[k][q][None], T[k][q][None])[0] for q in ('lit', 'mid', 'shadow')]
        cur[k] = hexl(h2lab(cur[k]) + err * 0.8)
    print(it, 'mean %.2f max %.2f' % (np.mean(ds), np.max(ds)), json.dumps(cur), flush=True)
