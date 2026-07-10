/*
 * gen-icons.js — 외부 의존성 없이(node 내장 zlib만) PWA용 PNG 아이콘 생성.
 *   node tools/gen-icons.js
 * 루트에 icon-512.png / icon-192.png / icon-180.png 출력.
 *
 * ★ 아이콘 디자인 가이드 (사용자 선호 확정 — hammynap/프차야/Paws-Order 계열) ★
 *   - 게임의 캐릭터 얼굴 또는 상징 "하나"를 크게 중앙에 (잡다한 요소 금지)
 *   - 플랫 스타일 + 파스텔 또는 대비 강한 단색 배경의 은은한 그라데이션
 *   - 라운드 배경, 충분한 여백, 스토리가 느껴지면 더 좋음 (예: 자는 햄스터+달)
 *   - 아래 drawDesign()의 예시(잠자는 동글 캐릭터)를 게임 모티프로 교체할 것
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..");
const SS = 3; // 슈퍼샘플링 (부드러운 가장자리)

// ── 디자인 (512×512 좌표계) ──────────────────────────────────────
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const BG_TOP = hex("#fff3e0"), BG_BOT = hex("#ffd9c2");   // 파스텔 배경 그라데이션
const FUR = hex("#e8b98a"), FUR_DARK = hex("#d9a06b");    // 캐릭터 몸/귀
const CREAM = hex("#fdf2df"), LINE = hex("#7a5230");      // 얼굴 안쪽/선
const BLUSH = hex("#f7b2a0");

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
// "︶" 모양 아크: 원 테두리 중 아래쪽 각도 범위만 (스크린 좌표: y 아래로 증가)
function inArc(x, y, cx, cy, r, t, a0, a1) {
  const d = Math.hypot(x - cx, y - cy);
  if (Math.abs(d - r) > t) return false;
  const a = Math.atan2(y - cy, x - cx); // -PI..PI, 0=오른쪽, PI/2=아래
  return a >= a0 && a <= a1;
}
function inRoundedSquare(x, y, size, rad) {
  const cx = Math.min(Math.max(x, rad), size - rad);
  const cy = Math.min(Math.max(y, rad), size - rad);
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
}

// 반환: [r,g,b,a] — 예시: 잠자는 동글 캐릭터 (게임 모티프로 교체)
function drawDesign(x, y) {
  if (!inRoundedSquare(x, y, 512, 110)) return [0, 0, 0, 0];
  let c = mix(BG_TOP, BG_BOT, y / 512); // 배경 그라데이션

  if (inCircle(x, y, 150, 158, 60)) c = FUR_DARK;            // 귀
  if (inCircle(x, y, 362, 158, 60)) c = FUR_DARK;
  if (inCircle(x, y, 150, 158, 34)) c = BLUSH;               // 귀 안쪽
  if (inCircle(x, y, 362, 158, 34)) c = BLUSH;
  if (inCircle(x, y, 256, 292, 152)) c = FUR;                // 얼굴
  if (inCircle(x, y, 256, 330, 108)) c = CREAM;              // 얼굴 안쪽
  if (inCircle(x, y, 152, 336, 27)) c = BLUSH;               // 볼터치
  if (inCircle(x, y, 360, 336, 27)) c = BLUSH;
  const A0 = Math.PI * 0.15, A1 = Math.PI * 0.85;            // "︶" 각도 범위
  if (inArc(x, y, 198, 268, 22, 6, A0, A1)) c = LINE;        // 감은 눈 (행복)
  if (inArc(x, y, 314, 268, 22, 6, A0, A1)) c = LINE;
  if (inCircle(x, y, 256, 312, 10)) c = LINE;                // 코
  if (inArc(x, y, 256, 342, 18, 5, A0, A1)) c = LINE;        // 입
  return [c[0], c[1], c[2], 255];
}

// ── PNG 인코딩 (RGBA, 필터 0, zlib) ──────────────────────────────
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function pngFromRGBA(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // 필터 없음
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── 래스터화: 슈퍼샘플링으로 디자인을 각 크기로 ─────────────────────
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = 512 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = drawDesign(
            (px + (sx + 0.5) / SS) * scale,
            (py + (sy + 0.5) / SS) * scale
          );
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      rgba[i] = r / n; rgba[i + 1] = g / n; rgba[i + 2] = b / n; rgba[i + 3] = a / n;
    }
  }
  return pngFromRGBA(size, size, rgba);
}

for (const size of [512, 192, 180]) {
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, render(size));
  console.log("생성:", file);
}
