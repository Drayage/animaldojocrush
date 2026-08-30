// 온라인 대전 뷰 변환 — 다른 참가자의 손패/덱/휴식패 "내용"을 화면에 노출하지 않는다.
//
// 주의(중요): 이 함수는 화면 표시 계층의 방어일 뿐, 서버측 부정행위 방지가 아니다.
// 공유 Firebase 프로젝트의 규칙은 `auth != null` 수준이라, 방 코드를 아는 인증 사용자는
// 네트워크 탭 / RTDB 콘솔에서 원본 payload(상대 손패 포함)를 볼 수 있다. 진짜 은닉이
// 필요하다면 참가자별 서버 계산 뷰(Cloud Functions 등)가 필요하며 이 저장소 범위 밖이다.
// 여기서는 최소한 "화면에 그리지 않는다"만 보장한다.

function maskCard(card) {
  // 카드 인스턴스 id는 리스트 렌더링 key 용도로만 남기고, 정체(definitionId)는 지운다.
  return { id: card.id, hidden: true };
}

function maskZone(cards) {
  return (cards || []).map(maskCard);
}

// state를 playerId 시점에서 본 모습으로 바꾼다: 본인 손패/덱/휴식패는 그대로,
// 다른 모든 참가자(중립 판다 사범 포함)의 손패/덱/휴식패는 개수만 남기고 정체를 지운다.
// 이미 공개된 정보(state.duel.plays, player.played, player.mastered, player.consumed)는
// 실제 게임 규칙상 공개 정보이므로 건드리지 않는다.
export function viewFor(state, viewerId) {
  if (!state) return state;
  const next = structuredClone(state);
  next.players = next.players.map((player) => {
    if (player.id === viewerId) return player;
    return {
      ...player,
      hand: maskZone(player.hand),
      deck: maskZone(player.deck),
      rest: maskZone(player.rest)
    };
  });
  return next;
}
