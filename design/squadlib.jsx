/* ============================================================
   GAFFER — squad model + validation helpers
   ============================================================ */
(function(){
  const FORMATIONS = {
    '4-4-2': {DEF:4,MID:4,FWD:2},
    '4-3-3': {DEF:4,MID:3,FWD:3},
    '3-5-2': {DEF:3,MID:5,FWD:2},
    '3-4-3': {DEF:3,MID:4,FWD:3},
    '5-3-2': {DEF:5,MID:3,FWD:2},
    '4-5-1': {DEF:4,MID:5,FWD:1},
  };
  const BENCH_POS = ['GK','DEF','MID','FWD'];

  function flatten(sq){
    const ids = [];
    ['GK','DEF','MID','FWD'].forEach(p => (sq[p]||[]).forEach(id => { if(id!=null) ids.push(id); }));
    (sq.bench||[]).forEach(b => { if(b.id!=null) ids.push(b.id); });
    return ids;
  }
  function spent(sq){
    const D = window.GAFFER_DATA;
    return flatten(sq).reduce((s,id)=> s + (D.PLAYER_BY_ID[id]?.price||0), 0);
  }
  function count(sq){ return flatten(sq).length; }
  function projectedPoints(sq){
    const D = window.GAFFER_DATA;
    return flatten(sq).reduce((s,id)=> s + (D.PLAYER_BY_ID[id]?.pts||0), 0);
  }
  function countryCounts(sq){
    const D = window.GAFFER_DATA; const m = {};
    flatten(sq).forEach(id => { const c = D.PLAYER_BY_ID[id]?.country; if(c) m[c]=(m[c]||0)+1; });
    return m;
  }
  function reshape(sq, formationName){
    const f = FORMATIONS[formationName];
    const out = { GK: sq.GK.slice(0,1), bench: sq.bench.map(b=>({...b})) };
    ['DEF','MID','FWD'].forEach(p=>{
      const cur = (sq[p]||[]).filter(x=>x!=null);
      const arr = [];
      for(let i=0;i<f[p];i++) arr.push(cur[i] ?? null);
      // overflow players go nowhere (dropped) — keeps it simple
      out[p] = arr;
    });
    return out;
  }
  function validate(sq, budget){
    const errors = [];
    const cc = countryCounts(sq);
    const overCountry = Object.entries(cc).filter(([c,n])=> n>3);
    const sp = spent(sq);
    const total = count(sq);
    const over = sp - budget > 0.001;
    if(over) errors.push({type:'budget', msg:`Over budget by £${(sp-budget).toFixed(1)}m — sell a player to continue.`});
    overCountry.forEach(([c,n])=> errors.push({type:'country', msg:`Max 3 players per country — you have ${n} from ${window.COUNTRY_NAME(c)}.`}));
    if(total < 15) errors.push({type:'incomplete', msg:`Squad incomplete — fill all 15 slots (${total}/15 picked).`});
    return { valid: errors.length===0, complete: total===15, errors, spent: sp, total };
  }
  function emptySquad(formationName='4-4-2'){
    const f = FORMATIONS[formationName];
    return {
      GK:[null], DEF:Array(f.DEF).fill(null), MID:Array(f.MID).fill(null), FWD:Array(f.FWD).fill(null),
      bench: BENCH_POS.map(p=>({pos:p,id:null})),
    };
  }
  function fromDefault(){
    const D = window.GAFFER_DATA, def = D.DEFAULT_SQUAD;
    const xi = def.startingXI.map(id=>D.PLAYER_BY_ID[id]);
    const by = p => xi.filter(x=>x.pos===p).map(x=>x.id);
    return {
      GK: by('GK'), DEF: by('DEF'), MID: by('MID'), FWD: by('FWD'),
      bench: def.bench.map(id=>({pos:D.PLAYER_BY_ID[id].pos, id})),
    };
  }

  window.SQUAD = { FORMATIONS, BENCH_POS, flatten, spent, count, projectedPoints, countryCounts, reshape, validate, emptySquad, fromDefault };
})();
