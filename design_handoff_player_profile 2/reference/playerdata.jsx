/* ============================================================
   GAFFER — player enrichment for the profile widget.
   Mirrors the real DB fields described in docs/player-fields.md:
   age, nationality, heightCm, weightKg, club, injured,
   seasonRating/Appearances/Minutes/Goals/Assists, + per-match
   PlayerMatchStat history and upcoming-fixture difficulty.
   All sample/virtual data, derived deterministically from each
   player's id so it's stable across renders.
   ============================================================ */
(function(){
  const D = window.GAFFER_DATA;

  // ---- real api-sports headshot ids (media.api-sports.io/football/players/<id>.png)
  // only mapped where we're confident of the id; everyone else falls back to the
  // jersey placeholder. In the live app every Player row has a real photoUrl.
  const PHOTO_ID = {
    'Mbappé':278, 'Haaland':1100, 'Kane':184, 'De Bruyne':629,
    'Bellingham':1485, 'Vinícius Jr':1500, 'Rodri':1466, 'Pedri':47397,
    'Bruno Fernandes':18846, 'Van Dijk':290, 'Modrić':606, 'Courtois':730,
    'Donnarumma':6948, 'Alisson':286, 'Rúben Dias':19150, 'Hakimi':21278,
    'Theo Hernández':22198, 'Pulisic':1124, 'Pickford':152,
  };

  // ---- club affiliation (the real player's club, drives "Club" line) ----
  const CLUB = {
    'Mbappé':'Real Madrid','Haaland':'Manchester City','Vinícius Jr':'Real Madrid',
    'Kane':'Bayern München','Lautaro Martínez':'Inter','Álvarez':'Atlético Madrid',
    'Osimhen':'Galatasaray','Rashford':'Aston Villa','Gakpo':'Liverpool',
    'En-Nesyri':'Fenerbahçe','Jiménez':'Fulham','Balogun':'Monaco',
    'Bellingham':'Real Madrid','Pedri':'Barcelona','De Bruyne':'Napoli',
    'Rodri':'Manchester City','Bruno Fernandes':'Manchester United','Modrić':'Milan',
    'Wirtz':'Liverpool','Pulisic':'Milan','Bruno Guimarães':'Newcastle',
    'Frenkie de Jong':'Barcelona','Mac Allister':'Liverpool','Doku':'Manchester City',
    'Kubo':'Real Sociedad','Amrabat':'Fenerbahçe','Reyna':'Borussia M.','Lozano':'PSV',
    'Hakimi':'Paris SG','Theo Hernández':'Al-Hilal','Saliba':'Arsenal','Rúben Dias':'Manchester City',
    'Van Dijk':'Liverpool','Marquinhos':'Paris SG','Cucurella':'Chelsea','Stones':'Manchester City',
    'Walker':'Burnley','Gvardiol':'Manchester City','Tajon Buchanan':'Villarreal',
    'Robinson':'Fulham','Araújo':'Barcelona','Koundé':'Barcelona',
    'Donnarumma':'Manchester City','Courtois':'Real Madrid','Alisson':'Liverpool',
    'Bono':'Al-Hilal','Maignan':'Milan','Turner':'Lyon','Ochoa':'AVS','Pickford':'Everton',
  };

  // ---- birthplace-ish age anchor + physicals are seeded per player ----
  const HEIGHT = { GK:[186,196], DEF:[178,192], MID:[170,184], FWD:[175,190] };

  // ---- opponent strength → fixture difficulty (FDR 1 easy … 5 hard) ----
  const STRENGTH = {
    BRA:5,FRA:5,ENG:5,ESP:5,ARG:5,GER:4,POR:4,NED:4,BEL:4,ITA:4,
    CRO:3,URU:3,USA:3,MEX:3,SEN:3,MAR:3,JPN:3,CAN:2,AUS:2,
  };
  const ALL_C = Object.keys(D.COUNTRIES);

  function seeded(seed){
    let s = seed*2654435761 % 2147483647; if(s<=0) s+=2147483646;
    return ()=>{ s = (s*16807) % 2147483647; return (s-1)/2147483646; };
  }
  const pick = (rnd, arr)=> arr[Math.floor(rnd()*arr.length)];
  const between = (rnd,a,b)=> a + rnd()*(b-a);
  const inti = (rnd,a,b)=> Math.round(between(rnd,a,b));

  const ROUND_SEQ = ['GS1','GS2','GS3','R32','R16'];
  const ROUND_FULL = { GS1:'Group Stage 1', GS2:'Group Stage 2', GS3:'Group Stage 3', R32:'Round of 32', R16:'Round of 16' };

  // derive a believable per-match line from a fantasy-points return
  function matchFromForm(rnd, p, fp, round){
    const isGK = p.pos==='GK', isDEF = p.pos==='DEF', isATT = p.pos==='FWD'||p.pos==='MID';
    const dnp = fp<=0 && rnd()<0.5;
    const minutes = dnp ? 0 : (rnd()<0.16 ? inti(rnd,20,70) : 90);
    let goals=0, assists=0, saves=0, cleanSheet=false;
    if(minutes>0){
      if(isATT){
        if(fp>=13) goals = rnd()<0.4?2:1, assists = rnd()<0.4?1:0;
        else if(fp>=9) (rnd()<0.6? goals=1 : assists=1);
        else if(fp>=6 && rnd()<0.4) assists=1;
      } else if(isDEF){
        cleanSheet = fp>=6;
        if(fp>=9 && rnd()<0.5) goals=1; else if(fp>=7 && rnd()<0.4) assists=1;
      } else { // GK
        saves = inti(rnd,1,6);
        cleanSheet = fp>=6;
      }
    }
    const yellow = minutes>0 && rnd()<0.18;
    const red = minutes>0 && fp<0 && rnd()<0.15;
    const rating = minutes===0 ? null : Math.max(5.4, Math.min(9.4, 6.0 + fp*0.21 + between(rnd,-0.3,0.3)));
    // opponent + scoreline
    const opp = (()=>{ let o; do { o = pick(rnd, ALL_C); } while(o===p.country); return o; })();
    const home = rnd()<0.5;
    const gf = inti(rnd, cleanSheet?1:0, 3), ga = cleanSheet?0:inti(rnd,0,3);
    return { round, roundFull:ROUND_FULL[round], opp, home,
      score:[gf,ga], result: gf>ga?'W':gf<ga?'L':'D',
      minutes, goals, assists, saves, cleanSheet, yellow, red,
      rating: rating==null?null:+rating.toFixed(1), fantasy: fp };
  }

  function buildUpcoming(rnd, p){
    const out = [];
    // try the real Round-of-16 fixture for this nation
    const r16 = (D.FIXTURES['Round of 16']||[]).find(m=>m.home===p.country||m.away===p.country);
    if(r16){
      const opp = r16.home===p.country? r16.away : r16.home;
      out.push({ round:'Round of 16', opp, home:r16.home===p.country, when:r16.day+' · '+r16.time,
        fdr: STRENGTH[opp]||3, live: r16.status==='live' });
    } else {
      const opp = (()=>{ let o; do { o=pick(rnd,ALL_C);} while(o===p.country); return o; })();
      out.push({ round:'Round of 16', opp, home:rnd()<0.5, when:'Sun 28 Jun · 16:00', fdr:STRENGTH[opp]||3 });
    }
    // synthesise the next two knockout rounds vs seeded strong sides
    [['Quarter-final','Wed 02 Jul · 20:00'],['Semi-final','Tue 08 Jul · 20:00']].forEach(([rd,when])=>{
      let opp; do { opp = pick(rnd, ALL_C); } while(opp===p.country);
      out.push({ round:rd, opp, home:rnd()<0.5, when, fdr:STRENGTH[opp]||3, tbd:true });
    });
    return out;
  }

  const cache = {};
  function get(p){
    if(cache[p.id]) return cache[p.id];
    const rnd = seeded(p.id+7);
    const [hMin,hMax] = HEIGHT[p.pos];
    const heightCm = inti(rnd, hMin, hMax);
    const weightKg = Math.round(heightCm*between(rnd,0.40,0.46));
    const age = inti(rnd, 21, 34);
    const apps = inti(rnd, 24, 38);
    const minutes = Math.round(apps * between(rnd, 62, 89));
    // goals/assists scaled by position + season points
    const attackBias = p.pos==='FWD'?1 : p.pos==='MID'?0.62 : p.pos==='DEF'?0.22 : 0.02;
    const goals = Math.max(0, Math.round((p.pts/9) * attackBias + between(rnd,-1,1)));
    const assists = Math.max(0, Math.round((p.pts/12) * (attackBias*0.8+0.15) + between(rnd,-1,1)));
    const rating = +Math.max(6.1, Math.min(8.1, 6.2 + p.ppg*0.2 + between(rnd,-0.15,0.15))).toFixed(2);
    const cleanSheets = (p.pos==='GK'||p.pos==='DEF') ? inti(rnd, 4, 12) : null;

    const matches = ROUND_SEQ.map((r,i)=> matchFromForm(seeded(p.id*31+i+1), p, p.form[i], r));
    const upcoming = buildUpcoming(seeded(p.id*53+3), p);

    const photoId = PHOTO_ID[p.name];
    const info = {
      age, heightCm, weightKg,
      nationality: window.COUNTRY_NAME(p.country),
      club: CLUB[p.name] || '—',
      injured: p.status==='out',
      season: { rating, apps, minutes, goals, assists, cleanSheets },
      matches, upcoming,
      photoUrl: photoId ? ('https://media.api-sports.io/football/players/'+photoId+'.png') : null,
    };
    cache[p.id] = info;
    return info;
  }

  window.PlayerInfo = { get, STRENGTH };
})();
