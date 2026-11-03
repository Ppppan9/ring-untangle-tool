// 参考视频（20.6 秒）逐拍还原的自动通关序列：t = 按下时刻(秒)，i = 环索引，d = 拖动时长(秒)，ga = 抓取点在环上的角度(°，屏幕坐标)，dir = 拖动方向(+1 顺时针)，blocked = 参考里没能取下的试探
// 0.25–2.55 拖左上绿环 → 2.6–3.1 飞走淡出；6.3–7.7 拖右上橙环 → 8.0 消失；9.5–14 在中间几环上试探（卡住）；15.0–16.0 右下黄环；17.1–18.3 左下红环；19.5 起移向紫环（参考视频到此结束），之后自动求解
export const REF_SEQ = [
  { t: 0.25, i: 0, d: 2.2, ga: 175, dir: 1 },
  { t: 6.3, i: 1, d: 1.4, ga: 15, dir: -1 },
  { t: 9.6, i: 7, d: 0.7, ga: -30, dir: 1, blocked: true },
  { t: 11.6, i: 6, d: 0.7, ga: 30, dir: 1, blocked: true },
  { t: 13.4, i: 3, d: 0.6, ga: 20, dir: -1, blocked: true },
  { t: 15.0, i: 10, d: 1.0, ga: 20, dir: 1 },
  { t: 17.1, i: 8, d: 1.2, ga: 160, dir: -1 },
  { t: 19.7, i: 7, d: 0.9, ga: 200, dir: 1, blocked: true },
];
export const REF_END = 20.6;
export const REF_HAND0 = { x: 73, y: 473 }; // 第 0 帧笔尖位置（设计坐标 720×1280）
// 字母型解锁参考（letters_ref.mp4 第 5 关 LUNCH，38.0 s 为第 0 帧）：0.3–2.6 顺时针转 C 让缺口对准右侧米珠 → 2.6 H 脱出飞入槽；3.0–5.0 继续转 C 到底部米珠 → 5.2 C 飞走；5.6 U；6.4 N；6.7 L
// 索引：0 C, 1 H, 2 U, 3 L, 4 N；sw = 本步旋转角度(°)
export const LETTER_SEQ = [
  { t: 0.3, i: 0, d: 2.2, ga: -90, dir: 1, sw: 185 },
  { t: 2.6, i: 1, d: 0.25, ga: -90, dir: 1, sw: 6 },
  { t: 3.0, i: 0, d: 2.0, ga: 0, dir: 1, sw: 95 },
  { t: 5.1, i: 0, d: 0.2, ga: 0, dir: 1, sw: 4 },
  { t: 5.6, i: 2, d: 0.25, ga: -90, dir: 1, sw: 6 },
  { t: 6.4, i: 4, d: 0.2, ga: -90, dir: 1, sw: 6 },
  { t: 6.7, i: 3, d: 0.2, ga: -90, dir: 1, sw: 6 },
];
export const LETTER_END = 8.5;
export const LETTER_HAND0 = { x: 560, y: 1120 };
