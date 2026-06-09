/* ============================================================
   GAFFER — betting data: per-team rosters + computed odds for
   the player markets (Anytime Goalscorer / To Assist / To Be
   Carded). Odds are derived from a player's position + rating
   (mirrors "our own formula" in the real app). Deterministic
   per name so they're stable across renders.
   ============================================================ */
(function(){
  // surname bank for generated squad fillers (the prototype's PLAYERS table
  // only has a handful per nation; the real DB has full 26-man squads).
  const SURNAMES = ['Costa','Silva','Mendez','Traoré','Kovač','Nakamura','Andersson','Bauer',
    'Rossi','Moreno','Haidara','Petrov','Okafor','Brandt','Lindqvist','Sané','Romero','Vidal',
    'Mertens','Sow','Diallo','Park','Nguyen','Yilmaz','Novak','Horvat','Marković','Sissoko',
    'Almeida','Ferreira','Schmidt','Larsen','Kone','Tanaka','Brahimi','Castro','Ibrahim','Cruz',
    'Wagner','Janssen','Müller','Borg','Eriksen','Suzuki','Toure','Vargas','Popović','Khan'];
  const INITIALS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','R','S','T'];

  function hash(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
  function seeded(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
  const r2 = n => Math.round(n*100)/100;
  const clamp = (n,a,b)=> Math.max(a,Math.min(b,n));

  // pos distribution for a generated squad (attack-weighted, outfield only here)
  const POS_BANK = ['FWD','FWD','MID','MID','MID','DEF','DEF','FWD','MID','DEF'];

  const cache = {};
  function roster(country){
    if(cache[country]) return cache[country];
    const rnd = seeded(hash('squad_'+country));
    const out = [];
    const seen = new Set();
    // seed with real prototype players for this nation (gives stars their real names)
    const D = window.GAFFER_DATA;
    (D?.PLAYERS||[]).filter(p=>p.country===country && p.pos!=='GK').forEach(p=>{
      const ln = p.name.split(' ').slice(-1)[0];
      if(seen.has(ln)) return; seen.add(ln);
      out.push({ name:p.name, pos:p.pos, rating: clamp(50 + p.price*3.3, 56, 92), real:true });
    });
    // pad to 8 with generated squad members
    let gi = 0;
    while(out.length < 8 && gi < 60){
      const sn = SURNAMES[Math.floor(rnd()*SURNAMES.length)];
      const ini = INITIALS[Math.floor(rnd()*INITIALS.length)];
      const name = ini+'. '+sn;
      gi++;
      if(seen.has(sn)) continue; seen.add(sn);
      const pos = POS_BANK[Math.floor(rnd()*POS_BANK.length)];
      out.push({ name, pos, rating: Math.round(60+rnd()*24), real:false });
    }
    cache[country] = out;
    return out;
  }

  const BASE = {
    scorer: {FWD:2.2, MID:3.7, DEF:8.0, GK:34},
    assist: {FWD:3.9, MID:3.1, DEF:6.8, GK:30},
    card:   {FWD:4.7, MID:3.4, DEF:3.0, GK:7.5},
  };
  function odds(pl, type){
    const base = BASE[type][pl.pos] ?? 5;
    let o;
    if(type==='card') o = base * (78/(pl.rating*0.55+34)); // rating matters little for cards
    else o = base * (76/pl.rating);                        // better player → shorter odds
    const j = ((hash(pl.name+type)%21)-10)/100;            // ±10% deterministic jitter
    return clamp(r2(o*(1+j)), 1.35, 41);
  }

  // players for a team+market, each with computed odds, sorted shortest-first
  function market(country, type){
    return roster(country)
      .map(pl => ({ name:pl.name, pos:pl.pos, odds: odds(pl,type) }))
      .sort((a,b)=> a.odds - b.odds);
  }

  const LABELS = { scorer:'Anytime Goalscorer', assist:'To Assist', card:'To Be Carded' };
  window.BetData = { roster, odds, market, LABELS };
})();
