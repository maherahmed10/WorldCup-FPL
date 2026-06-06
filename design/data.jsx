/* ============================================================
   GAFFER — placeholder data. All virtual points, sample only.
   ============================================================ */

// Country registry: code -> { name, flag colors handled in flags.jsx }
const COUNTRIES = {
  BRA:{name:'Brazil'}, FRA:{name:'France'}, ENG:{name:'England'}, ESP:{name:'Spain'},
  ARG:{name:'Argentina'}, GER:{name:'Germany'}, POR:{name:'Portugal'}, NED:{name:'Netherlands'},
  BEL:{name:'Belgium'}, CRO:{name:'Croatia'}, USA:{name:'USA'}, MEX:{name:'Mexico'},
  CAN:{name:'Canada'}, JPN:{name:'Japan'}, MAR:{name:'Morocco'}, SEN:{name:'Senegal'},
  URU:{name:'Uruguay'}, ITA:{name:'Italy'},
};

let _id = 0;
const P = (name, country, pos, price, pts, ppg, form, opts={}) => ({
  id: ++_id, name, country, pos, price, pts, ppg, form,
  eliminated: !!opts.eliminated, status: opts.status || 'fit', // fit | doubt | out
  selBy: opts.selBy || Math.round(8 + Math.random()*60),
});

// pos: GK DEF MID FWD
const PLAYERS = [
  // Forwards (premium)
  P('Mbappé','FRA','FWD',12.5,68,8.5,[9,12,6,14,8]),
  P('Haaland','GER','FWD',12.0,61,7.6,[7,2,15,9,4],{status:'doubt'}),
  P('Vinícius Jr','BRA','FWD',11.5,59,7.4,[6,11,8,5,12]),
  P('Kane','ENG','FWD',11.0,57,7.1,[8,9,6,10,3]),
  P('Lautaro Martínez','ARG','FWD',9.5,48,6.0,[5,8,4,9,7]),
  P('Álvarez','ARG','FWD',8.5,44,5.5,[6,3,7,8,5]),
  P('Osimhen','SEN','FWD',8.0,39,4.9,[4,6,2,9,5],{country:'SEN'}),
  P('Rashford','ENG','FWD',8.0,41,5.1,[7,2,5,8,4]),
  P('Gakpo','NED','FWD',7.5,36,4.5,[3,5,6,4,7]),
  P('En-Nesyri','MAR','FWD',6.5,31,3.9,[2,4,6,3,5]),
  P('Jiménez','MEX','FWD',6.0,28,3.5,[3,2,4,5,2]),
  P('Balogun','USA','FWD',6.0,26,3.3,[2,4,3,2,5]),

  // Midfielders
  P('Bellingham','ENG','MID',10.5,62,7.8,[8,11,9,7,12]),
  P('Pedri','ESP','MID',9.0,51,6.4,[6,9,5,8,7]),
  P('De Bruyne','BEL','MID',9.5,49,6.1,[10,4,7,5,8],{status:'doubt'}),
  P('Rodri','ESP','MID',8.5,47,5.9,[6,7,5,8,6]),
  P('Bruno Fernandes','POR','MID',9.0,50,6.3,[7,8,6,9,5]),
  P('Modrić','CRO','MID',7.0,34,4.3,[5,4,6,3,5],{status:'fit'}),
  P('Wirtz','GER','MID',8.0,43,5.4,[6,5,7,4,8]),
  P('Pulisic','USA','MID',7.5,40,5.0,[5,6,4,7,5]),
  P('Bruno Guimarães','BRA','MID',7.0,35,4.4,[4,5,6,3,5]),
  P('Frenkie de Jong','NED','MID',7.5,38,4.8,[5,4,6,5,4]),
  P('Mac Allister','ARG','MID',7.5,39,4.9,[6,3,5,7,4]),
  P('Doku','BEL','MID',6.5,30,3.8,[3,4,5,2,6]),
  P('Kubo','JPN','MID',6.0,29,3.6,[4,3,5,2,4]),
  P('Amrabat','MAR','MID',5.5,24,3.0,[2,3,4,2,3]),
  P('Reyna','USA','MID',5.5,23,2.9,[3,2,4,2,2]),
  P('Lozano','MEX','MID',6.0,27,3.4,[3,4,2,5,3]),

  // Defenders
  P('Hakimi','MAR','DEF',6.5,38,4.8,[5,6,4,7,5]),
  P('Theo Hernández','FRA','DEF',6.5,36,4.5,[4,6,5,4,6]),
  P('Saliba','FRA','DEF',6.0,34,4.3,[5,4,6,3,5]),
  P('Rúben Dias','POR','DEF',6.0,33,4.1,[4,5,4,5,4]),
  P('Van Dijk','NED','DEF',6.0,35,4.4,[5,4,6,4,5]),
  P('Marquinhos','BRA','DEF',5.5,31,3.9,[4,3,5,4,4]),
  P('Cucurella','ESP','DEF',5.5,30,3.8,[3,5,4,3,5]),
  P('Stones','ENG','DEF',5.5,29,3.6,[4,3,4,5,3]),
  P('Walker','ENG','DEF',5.0,27,3.4,[3,4,3,4,3]),
  P('Gvardiol','CRO','DEF',5.5,28,3.5,[3,4,4,3,4]),
  P('Tajon Buchanan','CAN','DEF',4.5,21,2.6,[2,3,2,3,2]),
  P('Robinson','USA','DEF',4.5,22,2.8,[3,2,3,2,3]),
  P('Araújo','URU','DEF',5.0,25,3.1,[3,3,4,2,3]),
  P('Koundé','FRA','DEF',5.5,29,3.6,[4,3,4,4,3]),

  // Goalkeepers
  P('Donnarumma','ITA','GK',5.5,34,4.3,[4,5,6,3,5]),
  P('Courtois','BEL','GK',5.5,33,4.1,[5,4,5,4,4]),
  P('Alisson','BRA','GK',5.5,35,4.4,[5,5,4,6,4]),
  P('Bono','MAR','GK',5.0,30,3.8,[4,3,5,4,4]),
  P('Maignan','FRA','GK',5.0,31,3.9,[4,4,3,5,4]),
  P('Turner','USA','GK',4.5,24,3.0,[3,2,4,3,2]),
  P('Ochoa','MEX','GK',4.5,26,3.3,[3,4,2,4,3]),
  P('Pickford','ENG','GK',5.0,32,4.0,[4,5,3,4,4]),
];

const PLAYER_BY_ID = Object.fromEntries(PLAYERS.map(p => [p.id, p]));
const byName = n => PLAYERS.find(p => p.name === n);

// Default saved squad: 4-4-2, £99.5m total, max 3 per country.
const STARTING_XI = [
  byName('Pickford').id,
  byName('Hakimi').id, byName('Saliba').id, byName('Gvardiol').id, byName('Walker').id,
  byName('Bellingham').id, byName('Mac Allister').id, byName('Lozano').id, byName('Kubo').id,
  byName('Mbappé').id, byName('Álvarez').id,
];
const BENCH = [ byName('Turner').id, byName('Robinson').id, byName('Amrabat').id, byName('Jiménez').id ];
const CAPTAIN = byName('Mbappé').id;
const VICE = byName('Bellingham').id;

// gameweek points for owned players (current GW). Kubo (JPN) eliminated → 0.
const GW_POINTS = {
  [byName('Pickford').id]:5, [byName('Hakimi').id]:9, [byName('Saliba').id]:6,
  [byName('Gvardiol').id]:4, [byName('Walker').id]:3, [byName('Bellingham').id]:12,
  [byName('Mac Allister').id]:7, [byName('Lozano').id]:5, [byName('Kubo').id]:0,
  [byName('Mbappé').id]:16, [byName('Álvarez').id]:8,
  [byName('Turner').id]:0, [byName('Robinson').id]:0, [byName('Amrabat').id]:0, [byName('Jiménez').id]:0,
};

// ---- Fixtures ----
const ROUNDS = ['Group Stage 1','Group Stage 2','Group Stage 3','Round of 32','Round of 16','Quarter-finals','Semi-finals','Final'];
const M = (home, away, day, time, status, hs, as_, venue) => ({home, away, day, time, status, hs, as_, venue});
const FIXTURES = {
  'Round of 16':[
    M('NED','USA','Sat 27 Jun','16:00','live',2,1,'AT&T Stadium, Dallas'),
    M('ARG','AUS','Sat 27 Jun','20:00','live',1,0,'SoFi Stadium, LA'),
    M('FRA','SEN','Sun 28 Jun','13:00','upcoming',null,null,'MetLife Stadium, NJ'),
    M('ENG','JPN','Sun 28 Jun','16:00','upcoming',null,null,'BMO Field, Toronto'),
    M('BRA','MEX','Mon 29 Jun','19:00','upcoming',null,null,'Estadio Azteca, MX'),
    M('ESP','MAR','Mon 29 Jun','15:00','upcoming',null,null,'Lumen Field, Seattle'),
    M('POR','BEL','Tue 30 Jun','18:00','upcoming',null,null,'Levi\'s Stadium, SF'),
    M('GER','CRO','Tue 30 Jun','21:00','upcoming',null,null,'Hard Rock, Miami'),
  ],
  'Group Stage 3':[
    M('FRA','MEX','Wed 24 Jun','18:00','finished',3,1,'NRG Stadium, Houston'),
    M('BRA','SEN','Wed 24 Jun','21:00','finished',2,2,'Lincoln Financial, Phila'),
    M('ENG','USA','Thu 25 Jun','20:00','finished',1,1,'Arrowhead, KC'),
    M('ESP','ITA','Thu 25 Jun','17:00','finished',2,0,'Mercedes-Benz, Atlanta'),
    M('ARG','CRO','Fri 26 Jun','19:00','finished',1,0,'Gillette, Boston'),
    M('GER','JPN','Fri 26 Jun','16:00','finished',2,1,'GEHA Field, KC'),
  ],
};
// Group standings (group stage) — sample for two groups
const GROUPS = {
  A:[
    {c:'ARG',pld:3,w:3,d:0,l:0,gf:7,ga:1,pts:9},
    {c:'CRO',pld:3,w:1,d:1,l:1,gf:4,ga:3,pts:4},
    {c:'MEX',pld:3,w:1,d:0,l:2,gf:3,ga:5,pts:3},
    {c:'CAN',pld:3,w:0,d:1,l:2,gf:2,ga:7,pts:1},
  ],
  B:[
    {c:'FRA',pld:3,w:2,d:1,l:0,gf:6,ga:2,pts:7},
    {c:'NED',pld:3,w:2,d:0,l:1,gf:5,ga:3,pts:6},
    {c:'JPN',pld:3,w:1,d:0,l:2,gf:3,ga:4,pts:3},
    {c:'SEN',pld:3,w:0,d:1,l:2,gf:2,ga:7,pts:1},
  ],
};

// ---- Leagues ----
const LEAGUES = [
  { id:'l1', name:'Office Pundits', code:'GAF-7K2P', members:14, you:3, type:'private',
    standings:[
      {rank:1, name:'Sara Mensah', team:'Mensah Marauders', gw:71, total:842, delta:0},
      {rank:2, name:'Diego Alvarez', team:'El Tri Dream', gw:64, total:818, delta:1},
      {rank:3, name:'You', team:'Gaffer FC', gw:78, total:806, delta:2, you:true},
      {rank:4, name:'Tom Becker', team:'Becker Boys', gw:55, total:799, delta:-2},
      {rank:5, name:'Priya Nair', team:'Mumbai United', gw:61, total:781, delta:0},
      {rank:6, name:'Liam O\'Connor', team:'Shamrock XI', gw:49, total:766, delta:-1},
      {rank:7, name:'Chen Wei', team:'Dragon Squad', gw:58, total:744, delta:1},
      {rank:8, name:'Marco Rossi', team:'Azzurri Always', gw:52, total:721, delta:0},
    ]},
  { id:'l2', name:'GAFFER Overall', code:null, members:2480551, you:184022, type:'global',
    standings:[
      {rank:1, name:'xG_Wizard', team:'Tiki Taka Terror', gw:96, total:1012, delta:0},
      {rank:2, name:'PoissonKing', team:'Expected Goals', gw:88, total:998, delta:0},
      {rank:3, name:'TheGaffer92', team:'Park The Bus', gw:84, total:991, delta:1},
    ]},
];

// ---- Predictions / markets ----
let _bid = 0;
const MARKETS = [
  { match:['FRA','SEN'], time:'Sun 28 Jun · 13:00', markets:[
      {key:'1x2', label:'Match Result', opts:[{name:'France',odds:1.7},{name:'Draw',odds:3.6},{name:'Senegal',odds:5.2}]},
      {key:'ou', label:'Over / Under 2.5 Goals', opts:[{name:'Over 2.5',odds:1.9},{name:'Under 2.5',odds:1.9}]},
      {key:'btts', label:'Both Teams To Score', opts:[{name:'Yes',odds:2.1},{name:'No',odds:1.7}]},
      {key:'scorer', label:'Anytime Goalscorer', opts:[{name:'Mbappé',odds:1.8},{name:'Osimhen',odds:3.4},{name:'Dembélé',odds:3.9}]},
  ]},
  { match:['ENG','JPN'], time:'Sun 28 Jun · 16:00', markets:[
      {key:'1x2', label:'Match Result', opts:[{name:'England',odds:1.5},{name:'Draw',odds:4.0},{name:'Japan',odds:6.5}]},
      {key:'ou', label:'Over / Under 2.5 Goals', opts:[{name:'Over 2.5',odds:2.0},{name:'Under 2.5',odds:1.8}]},
      {key:'btts', label:'Both Teams To Score', opts:[{name:'Yes',odds:2.3},{name:'No',odds:1.6}]},
      {key:'scorer', label:'Anytime Goalscorer', opts:[{name:'Kane',odds:1.7},{name:'Bellingham',odds:2.6},{name:'Kubo',odds:4.5}]},
  ]},
  { match:['BRA','MEX'], time:'Mon 29 Jun · 19:00', markets:[
      {key:'1x2', label:'Match Result', opts:[{name:'Brazil',odds:1.6},{name:'Draw',odds:3.8},{name:'Mexico',odds:5.5}]},
      {key:'ou', label:'Over / Under 2.5 Goals', opts:[{name:'Over 2.5',odds:1.85},{name:'Under 2.5',odds:1.95}]},
      {key:'btts', label:'Both Teams To Score', opts:[{name:'Yes',odds:1.95},{name:'No',odds:1.85}]},
      {key:'scorer', label:'Anytime Goalscorer', opts:[{name:'Vinícius Jr',odds:2.0},{name:'Jiménez',odds:3.6},{name:'Raphinha',odds:2.9}]},
  ]},
];

const SETTLED_BETS = [
  { id:++_bid, match:['ESP','ITA'], market:'Match Result', pick:'Spain', stake:120, odds:1.8, status:'won', payout:216 },
  { id:++_bid, match:['GER','JPN'], market:'Over / Under 2.5', pick:'Over 2.5', stake:80, odds:1.9, status:'won', payout:152 },
  { id:++_bid, match:['BRA','SEN'], market:'Both Teams To Score', pick:'No', stake:100, odds:1.7, status:'lost', payout:0 },
];

const PROFILE = {
  name:'You', team:'Gaffer FC', handle:'@thegaffer',
  totalPoints:806, gwPoints:78, rank:184022, rankDelta:12044, budgetValue:99.5,
  predBalance:340, gameweek:'Round of 16', deadline: nextDeadline(),
};

function nextDeadline(){
  const d = new Date();
  d.setDate(d.getDate()+1); d.setHours(12,0,0,0);
  return d.getTime();
}

window.GAFFER_DATA = {
  COUNTRIES, PLAYERS, PLAYER_BY_ID, ROUNDS, FIXTURES, GROUPS, LEAGUES,
  MARKETS, SETTLED_BETS, PROFILE,
  DEFAULT_SQUAD: { startingXI: STARTING_XI, bench: BENCH, captain: CAPTAIN, vice: VICE, gwPoints: GW_POINTS },
  BUDGET: 100,
};
