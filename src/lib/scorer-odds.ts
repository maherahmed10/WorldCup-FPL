// ─────────────────────────────────────────────────────────────────────────
// Judgement-based anytime-scorer odds for elite finishers (build-plan §6/§7).
//
// API-Football has NO individual player-scorer market for the World Cup
// (confirmed — only team-level "to score first" etc.), so we price these
// ourselves. This table hand-tunes the ~60 best-known goalscorers using
// football judgement (finishing quality, role, penalty duties, recent form),
// calibrated to a realistic anytime-scorer scale:
//
//   ~1.5–1.8  elite finisher / nailed penalty taker (Haaland, Mbappé, Kane…)
//   ~1.8–2.3  top forward
//   ~2.5–3.5  goal-scoring winger / attacking mid
//   ~4.5–7.0  deep midfielder who rarely scores
//
// Keys are the exact Player.name as stored from API-Football. Anyone NOT in this
// table falls back to the position+price formula (betting.ts → scorerMultiplier).
// Lower number = more likely to score.
// ─────────────────────────────────────────────────────────────────────────

export const SCORER_JUDGEMENT: Record<string, number> = {
  // ── Elite finishers / primary penalty takers ──
  "E. Haaland": 1.5,
  "Kylian Mbappé": 1.55,
  "H. Kane": 1.55,
  "Mohamed Salah": 1.7,
  "Cristiano Ronaldo": 1.75,
  "Lautaro Martínez": 1.85,
  "L. Messi": 1.8,
  "V. Gyökeres": 1.85,
  "A. Isak": 1.9,
  "Lamine Yamal": 2.1,

  // ── Top forwards ──
  "O. Dembélé": 2.1,
  "Vinícius Júnior": 2.0,
  "B. Saka": 2.2,
  "J. Álvarez": 2.0,
  "Rafael Leão": 2.3,
  "C. Gakpo": 2.3,
  "Nico Williams": 2.4,
  "L. Suárez": 2.2,
  "Son Heung-Min": 2.2,
  "K. Havertz": 2.3,
  "D. Núñez": 2.2,
  "Gonçalo Ramos": 2.2,
  "Matheus Cunha": 2.5,
  "Endrick": 2.4,
  "O. Watkins": 2.3,
  "Mikel Oyarzabal": 2.4,
  "S. Giménez": 2.4,
  "A. Kramaric": 2.5,
  "M. Rashford": 2.5,
  "J. Córdoba": 2.6,
  "Neymar": 2.3,
  "J. Doku": 3.0,
  "A. Gordon": 2.8,
  "K. Yildiz": 2.8,
  "João Félix": 2.7,
  "B. Barcola": 2.6,
  "D. Doué": 2.8,
  "Gabriel Martinelli": 2.8,
  "C. De Ketelaere": 2.9,
  "T. Kubo": 3.2,
  "C. Pulisic": 2.8,

  // ── Goal-scoring mids / wingers ──
  "J. Bellingham": 2.4,
  "J. Musiala": 2.6,
  "L. Díaz": 2.4,
  "K. De Bruyne": 2.8,
  "F. Wirtz": 2.9,
  "M. Olise": 3.0,
  "M. Ødegaard": 3.2,
  "Raphinha": 2.6,
  "Bruno Fernandes": 2.7,
  "Pedri": 4.0,
  "Dani Olmo": 3.2,
  "R. Cherki": 3.4,
  "Brahim Díaz": 3.3,
  "A. Güler": 3.5,
  "J. Rodríguez": 3.4,
  "L. Modric": 4.5,
  "F. Valverde": 3.8,
  "Bernardo Silva": 3.6,
  "Vitinha": 4.5,
  "M. Thuram": 3.6,

  // ── Deep mids who rarely score ──
  "Rodri": 6.0,
  "D. Rice": 6.5,
  "F. de Jong": 5.5,
  "A. Mac Allister": 4.5,
  "M. Caicedo": 6.5,
  "R. Gravenberch": 6.0,
  "Bruno Guimarães": 5.5,
  "T. Reijnders": 5.0,
  "J. Arias": 4.0,
};

/** Judgement scorer odds for a player by exact name, or null if not curated. */
export function judgementScorerOdds(name: string): number | null {
  return SCORER_JUDGEMENT[name] ?? null;
}
