export function calculateEloRating(oldRating, opponentRating, outcome, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - oldRating) / 400));
  return oldRating + k * (outcome - expected);
}

export function computeNewRatings(gameResult) {
  const { mode, players } = gameResult;
  if (!Array.isArray(players) || players.length !== 2) {
    return {};
  }
  const [p1, p2] = players;
  const old1 = Number(p1.old_rating ?? 1500);
  const old2 = Number(p2.old_rating ?? 1500);
  let out1 = 0, out2 = 0;
  if (Number(p1.score) > Number(p2.score)) {
    out1 = 1; out2 = 0;
  } else if (Number(p1.score) < Number(p2.score)) {
    out1 = 0; out2 = 1;
  } else {
    out1 = 0.5; out2 = 0.5;
  }
  const new1 = calculateEloRating(old1, old2, out1);
  const new2 = calculateEloRating(old2, old1, out2);
  return { [String(p1.user_id)]: new1, [String(p2.user_id)]: new2, mode };
}


