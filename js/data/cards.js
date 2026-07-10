export const CARD_DEFINITIONS = Object.freeze({
  start_1: { id: "start_1", name: "기초 앞차기", power: 1, cost: 0, type: "starter", ability: null, exhausts: false, marketCount: 0, text: "위력 1" },
  start_2: { id: "start_2", name: "기초 막기", power: 2, cost: 0, type: "starter", ability: null, exhausts: false, marketCount: 0, text: "위력 2" },
  start_3: { id: "start_3", name: "빙글 돌려차기", power: 3, cost: 0, type: "starter", ability: null, exhausts: false, marketCount: 0, text: "위력 3" },
  start_4: { id: "start_4", name: "폴짝 내려찍기", power: 4, cost: 0, type: "starter", ability: null, exhausts: false, marketCount: 0, text: "위력 4" },
  start_5: { id: "start_5", name: "도장 함성", power: 5, cost: 0, type: "starter", ability: null, exhausts: false, marketCount: 0, text: "위력 5" },
  combo_stance: { id: "combo_stance", name: "연계 자세", power: 1, cost: 1, type: "market", ability: "combo", exhausts: false, marketCount: 5, text: "덱 맨 위 기술을 이어서 공개합니다." },
  bunny_kick: { id: "bunny_kick", name: "토끼뜀차기", power: 6, cost: 2, type: "market", ability: null, exhausts: false, marketCount: 5, text: "위력 6" },
  tail_spin: { id: "tail_spin", name: "회오리 꼬리치기", power: 7, cost: 4, type: "market", ability: null, exhausts: false, marketCount: 5, text: "위력 7" },
  maple_combo: { id: "maple_combo", name: "단풍잎 연타", power: 8, cost: 6, type: "market", ability: null, exhausts: false, marketCount: 4, text: "위력 8" },
  headbutt: { id: "headbutt", name: "혼신의 박치기", power: 9, cost: 8, type: "market", ability: null, exhausts: true, marketCount: 5, text: "사용 후 소모됩니다." },
  tiger_dash: { id: "tiger_dash", name: "맹호 돌진", power: 10, cost: 10, type: "market", ability: null, exhausts: false, marketCount: 3, text: "위력 10" },
  legend_fist: { id: "legend_fist", name: "전설의 동물권", power: 20, cost: 18, type: "market", ability: null, exhausts: true, marketCount: 2, text: "사용 후 소모됩니다." }
});

export const MARKET_CARD_IDS = ["combo_stance", "bunny_kick", "tail_spin", "maple_combo", "headbutt", "tiger_dash", "legend_fist"];
export const STARTER_CARD_IDS = ["start_1", "start_2", "start_3", "start_4", "start_5"];
export const cardDef = (card) => CARD_DEFINITIONS[typeof card === "string" ? card : card.definitionId];
