// 예시 팔레트 3종 — "Web Audio가 이만큼 달라질 수 있다"의 증명 겸 출발점.
// ★ 새 게임에서는 이걸 그대로 쓰지 말 것. 사용자에게 사운드 정체성 키워드
//   (형용사 3~4개 + 금지어)를 먼저 받고 게임 전용 팔레트를 새로 만든다. ★
// audio-preview.html에서 셋을 비교해 들어볼 수 있다.

// 1) 우디 — 나무 말 놓는 보드게임 톤 (진중, 둔탁, 고역 억제) — secrettactics 계열
export const WOODY = {
  name: "우디 (보드게임)",
  sfx: {
    tap: [
      { t: "tone", wave: "sine", freq: 190, freqEnd: 120, dur: 0.09, gain: 0.7, lp: 900 },
      { t: "noise", dur: 0.025, gain: 0.25, lp: 1400 },
    ],
    confirm: [
      { t: "tone", wave: "sine", freq: 240, freqEnd: 160, dur: 0.12, gain: 0.7, lp: 1000 },
      { t: "tone", wave: "sine", freq: 360, freqEnd: 240, dur: 0.1, gain: 0.3, lp: 1000 },
    ],
    error: [{ t: "tone", wave: "sine", freq: 110, freqEnd: 80, dur: 0.22, gain: 0.6, lp: 600 }],
    win: [
      { t: "tone", wave: "sine", freq: 262, dur: 0.5, gain: 0.5, lp: 1200 },
      { t: "tone", wave: "sine", freq: 330, dur: 0.5, gain: 0.4, lp: 1200 },
      { t: "tone", wave: "sine", freq: 392, dur: 0.7, gain: 0.4, lp: 1200 },
    ],
  },
  bgm: {
    main: {
      tempo: 66,
      loopBeats: 16,
      inst: { wave: "sine", gain: 0.28, attack: 0.01, lp: 1100 },
      notes: [
        [0, 131, 1.5], [2, 165, 1], [4, 147, 1.5], [6, 110, 1],
        [8, 131, 1.5], [10, 196, 1], [12, 165, 2], [14, 147, 1.5],
      ],
    },
  },
};

// 2) 8-bit — 레트로 아케이드 톤 (경쾌, 각진, 빠른 아르페지오)
export const CHIPTUNE = {
  name: "8-bit (아케이드)",
  sfx: {
    tap: [{ t: "tone", wave: "square", freq: 660, dur: 0.05, gain: 0.25 }],
    confirm: [
      { t: "tone", wave: "square", freq: 523, dur: 0.06, gain: 0.25 },
      { t: "tone", wave: "square", freq: 784, dur: 0.08, gain: 0.25, attack: 0.06 },
    ],
    error: [{ t: "tone", wave: "square", freq: 196, freqEnd: 98, dur: 0.2, gain: 0.3 }],
    win: [
      { t: "tone", wave: "square", freq: 523, dur: 0.09, gain: 0.25 },
      { t: "tone", wave: "square", freq: 659, dur: 0.09, gain: 0.25, attack: 0.09 },
      { t: "tone", wave: "square", freq: 784, dur: 0.09, gain: 0.25, attack: 0.18 },
      { t: "tone", wave: "square", freq: 1047, dur: 0.25, gain: 0.3, attack: 0.27 },
    ],
  },
  bgm: {
    main: {
      tempo: 140,
      loopBeats: 8,
      inst: { wave: "square", gain: 0.12, attack: 0.005 },
      notes: [
        [0, 262, 0.5], [1, 330, 0.5], [2, 392, 0.5], [3, 330, 0.5],
        [4, 294, 0.5], [5, 370, 0.5], [6, 440, 0.5], [7, 370, 0.5],
      ],
    },
  },
};

// 3) 파스텔 — 말랑하고 동글동글한 물방울 톤 (부드러운 어택, 위로 휘는 음정)
export const PASTEL = {
  name: "파스텔 (말랑)",
  sfx: {
    tap: [{ t: "tone", wave: "triangle", freq: 520, freqEnd: 690, dur: 0.14, gain: 0.4, attack: 0.02, lp: 2400 }],
    confirm: [
      { t: "tone", wave: "triangle", freq: 440, freqEnd: 660, dur: 0.2, gain: 0.4, attack: 0.03, lp: 2600 },
      { t: "tone", wave: "sine", freq: 880, freqEnd: 1320, dur: 0.18, gain: 0.15, attack: 0.05, lp: 3000 },
    ],
    error: [{ t: "tone", wave: "triangle", freq: 330, freqEnd: 262, dur: 0.3, gain: 0.35, attack: 0.03, lp: 1600 }],
    win: [
      { t: "tone", wave: "triangle", freq: 523, freqEnd: 587, dur: 0.35, gain: 0.35, attack: 0.04, lp: 2600 },
      { t: "tone", wave: "triangle", freq: 659, freqEnd: 740, dur: 0.4, gain: 0.3, attack: 0.12, lp: 2600 },
      { t: "tone", wave: "sine", freq: 1047, freqEnd: 1175, dur: 0.5, gain: 0.15, attack: 0.2, lp: 3200 },
    ],
  },
  bgm: {
    main: {
      tempo: 92,
      loopBeats: 16,
      inst: { wave: "triangle", gain: 0.2, attack: 0.03, lp: 2000 },
      notes: [
        [0, 392, 1], [1.5, 440, 0.5], [2, 523, 1.5], [4, 494, 1],
        [6, 440, 1], [8, 392, 1], [9.5, 330, 0.5], [10, 349, 1.5],
        [12, 440, 1], [14, 392, 2],
      ],
    },
  },
};

export const ANIMAL_DOJO = {
  name: "동물도장",
  sfx: {
    ...PASTEL.sfx,
    card: [
      { t: "noise", dur: 0.07, gain: 0.18, hp: 1000, lp: 4200 },
      { t: "tone", wave: "triangle", freq: 320, freqEnd: 480, dur: 0.09, gain: 0.24, lp: 2200 },
    ],
    combo: [
      { t: "tone", wave: "triangle", freq: 440, freqEnd: 720, dur: 0.18, gain: 0.3, lp: 2800 },
      { t: "tone", wave: "sine", freq: 660, freqEnd: 1040, dur: 0.22, gain: 0.17, attack: 0.05, lp: 3200 },
    ],
    exhaust: [
      { t: "noise", dur: 0.18, gain: 0.26, hp: 600, lp: 3600 },
      { t: "tone", wave: "sawtooth", freq: 250, freqEnd: 90, dur: 0.2, gain: 0.18, lp: 1500 },
    ],
    duelWin: [
      { t: "tone", wave: "triangle", freq: 392, freqEnd: 523, dur: 0.28, gain: 0.32, lp: 2800 },
      { t: "tone", wave: "triangle", freq: 523, freqEnd: 784, dur: 0.36, gain: 0.28, attack: 0.09, lp: 3000 },
      { t: "noise", dur: 0.1, gain: 0.12, hp: 1600, lp: 4800 },
    ],
    fame: [
      { t: "tone", wave: "sine", freq: 660, freqEnd: 990, dur: 0.2, gain: 0.23, lp: 3400 },
      { t: "tone", wave: "triangle", freq: 880, freqEnd: 1320, dur: 0.28, gain: 0.16, attack: 0.08, lp: 3800 },
    ],
    experience: [
      { t: "tone", wave: "sine", freq: 330, freqEnd: 494, dur: 0.18, gain: 0.24, lp: 2600 },
      { t: "tone", wave: "sine", freq: 494, freqEnd: 659, dur: 0.2, gain: 0.16, attack: 0.07, lp: 3000 },
    ],
    buy: [
      { t: "tone", wave: "triangle", freq: 294, freqEnd: 440, dur: 0.16, gain: 0.25, lp: 2500 },
      { t: "tone", wave: "triangle", freq: 440, freqEnd: 587, dur: 0.2, gain: 0.2, attack: 0.08, lp: 2800 },
    ],
    mastery: [
      { t: "tone", wave: "sine", freq: 523, freqEnd: 1047, dur: 0.42, gain: 0.25, lp: 3600 },
      { t: "noise", dur: 0.24, gain: 0.08, hp: 2200, lp: 6000 },
    ],
    milestone: [
      { t: "tone", wave: "triangle", freq: 523, dur: 0.14, gain: 0.27, lp: 3200 },
      { t: "tone", wave: "triangle", freq: 659, dur: 0.16, gain: 0.24, attack: 0.1, lp: 3200 },
      { t: "tone", wave: "triangle", freq: 784, dur: 0.3, gain: 0.22, attack: 0.2, lp: 3400 },
    ],
    champion: [
      { t: "tone", wave: "triangle", freq: 392, freqEnd: 523, dur: 0.42, gain: 0.28, lp: 3000 },
      { t: "tone", wave: "triangle", freq: 523, freqEnd: 784, dur: 0.48, gain: 0.25, attack: 0.14, lp: 3200 },
      { t: "tone", wave: "sine", freq: 784, freqEnd: 1175, dur: 0.7, gain: 0.2, attack: 0.28, lp: 3800 },
    ],
  },
  bgm: {
    main: {
      tempo: 84,
      loopBeats: 16,
      inst: { wave: "triangle", gain: 0.16, attack: 0.035, lp: 1800 },
      notes: [
        [0, 392, 1.5], [2, 523, 1], [4, 440, 1.5], [6, 330, 1],
        [8, 349, 1.5], [10, 440, 1], [12, 494, 1], [14, 392, 2],
      ],
    },
  },
};

export const ALL_PALETTES = { WOODY, CHIPTUNE, PASTEL, ANIMAL_DOJO };
