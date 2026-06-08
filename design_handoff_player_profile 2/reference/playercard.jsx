/* ============================================================
   GAFFER — Player Profile widget (API-Football style).
   window.PlayerProfile({player, onClose})
   window.usePlayerProfile() -> [node, open(player)]
   ============================================================ */
(function(){
  const { useState } = React;
  const Icon=window.Icon, Flag=window.Flag, Jersey=window.Jersey, Spark=window.Spark,
        Modal=window.Modal, Segmented=window.Segmented;
  const last = n => n.split(' ').slice(-1)[0];
  const initials = n => n.replace(/[^A-Za-zÀ-ÿ\s].*/,'').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();

  // ---- headshot with graceful jersey fallback ----
  function PlayerPhoto({player}){
    const info = window.PlayerInfo.get(player);
    const [failed,setFailed] = useState(!info.photoUrl);
    return React.createElement('div',{className:'pp-photo'},
      React.createElement('div',{className:'pp-photo-ring pos-ring-'+player.pos}),
      failed
        ? React.createElement('div',{className:'pp-photo-fallback'},
            React.createElement(Jersey,{code:player.country,size:74}),
            React.createElement('span',{className:'pp-initials'}, initials(player.name)))
        : React.createElement('img',{className:'pp-img', src:info.photoUrl, alt:player.name,
            onError:()=>setFailed(true)}),
      React.createElement('span',{className:'pp-photo-flag'}, React.createElement(Flag,{code:player.country,size:18,round:true}))
    );
  }

  // ---- status pill ----
  function StatusPill({status}){
    if(status==='out') return React.createElement('span',{className:'pill pill-live'},
      React.createElement(Icon,{name:'info',size:12}),' Injured');
    if(status==='doubt') return React.createElement('span',{className:'pill pill-gold'},
      React.createElement(Icon,{name:'info',size:12}),' Fitness doubt');
    return React.createElement('span',{className:'pill pill-accent'},
      React.createElement(Icon,{name:'check',size:12}),' Match fit');
  }

  function Vital({label, value, sub}){
    return React.createElement('div',{className:'pp-vital'},
      React.createElement('div',{className:'pp-vital-val num'}, value),
      React.createElement('div',{className:'pp-vital-lab'}, label),
      sub && React.createElement('div',{className:'pp-vital-sub'}, sub));
  }

  // ---- season statistics block ----
  function StatsTab({player, info}){
    const s = info.season;
    const ratingPct = Math.max(0, Math.min(100, ((s.rating-5)/5)*100));
    const Stat = ({k,v})=>React.createElement('div',{className:'pp-stat'},
      React.createElement('div',{className:'pp-stat-v num'}, v),
      React.createElement('div',{className:'pp-stat-k'}, k));
    return React.createElement('div',{className:'pp-tabbody'},
      // season statistics
      React.createElement('div',{className:'pp-section'},
        React.createElement('div',{className:'pp-sec-head'},
          React.createElement('span',null,'Season statistics'),
          React.createElement('span',{className:'pp-sec-note'}, 'World Cup qualifying + club')),
        React.createElement('div',{className:'pp-rating'},
          React.createElement('div',{className:'pp-rating-top'},
            React.createElement('span',{className:'pp-rating-lab'},'Avg. match rating'),
            React.createElement('span',{className:'pp-rating-num num'}, s.rating.toFixed(2))),
          React.createElement('div',{className:'pp-rating-track'},
            React.createElement('div',{className:'pp-rating-fill', style:{width:ratingPct+'%'}})),
          React.createElement('div',{className:'pp-rating-scale'},
            React.createElement('span',null,'5.0'),React.createElement('span',null,'7.5'),React.createElement('span',null,'10'))),
        React.createElement('div',{className:'pp-stat-grid'},
          React.createElement(Stat,{k:'Apps', v:s.apps}),
          React.createElement(Stat,{k:'Minutes', v:s.minutes.toLocaleString()}),
          React.createElement(Stat,{k:'Goals', v:s.goals}),
          React.createElement(Stat,{k:'Assists', v:s.assists}),
          s.cleanSheets!=null && React.createElement(Stat,{k:'Clean sheets', v:s.cleanSheets}))),
      // fantasy block
      React.createElement('div',{className:'pp-section'},
        React.createElement('div',{className:'pp-sec-head'},
          React.createElement('span',null,'GAFFER fantasy'),
          React.createElement('span',{className:'pp-sec-note'}, player.selBy+'% of managers picked')),
        React.createElement('div',{className:'pp-fantasy'},
          React.createElement('div',{className:'pp-fan-cell'},
            React.createElement('div',{className:'pp-fan-v num accent'}, player.pts),
            React.createElement('div',{className:'pp-fan-k'},'Total pts')),
          React.createElement('div',{className:'pp-fan-cell'},
            React.createElement('div',{className:'pp-fan-v num'}, player.ppg.toFixed(1)),
            React.createElement('div',{className:'pp-fan-k'},'Per game')),
          React.createElement('div',{className:'pp-fan-cell'},
            React.createElement('div',{className:'pp-fan-v num'}, player.selBy+'%'),
            React.createElement('div',{className:'pp-fan-k'},'Selected')),
          React.createElement('div',{className:'pp-fan-cell pp-fan-spark'},
            React.createElement(Spark,{data:player.form, w:108, h:34}),
            React.createElement('div',{className:'pp-fan-k'},'Last 5 form'))))
    );
  }

  // ---- match-by-match ----
  function MatchesTab({info}){
    const cardDot = m => React.createElement('span',{className:'pp-cards'},
      m.yellow && React.createElement('span',{className:'pp-card yellow'}),
      m.red && React.createElement('span',{className:'pp-card red'}));
    return React.createElement('div',{className:'pp-tabbody'},
      React.createElement('div',{className:'pp-matches'},
        React.createElement('div',{className:'pp-mh'},
          React.createElement('span',{className:'pp-mh-rd'},'Round'),
          React.createElement('span',{className:'pp-mh-opp'},'Opponent'),
          React.createElement('span',{className:'pp-mh-c'},'Min'),
          React.createElement('span',{className:'pp-mh-c'},'G'),
          React.createElement('span',{className:'pp-mh-c'},'A'),
          React.createElement('span',{className:'pp-mh-c'},'Rtg'),
          React.createElement('span',{className:'pp-mh-c pts'},'Pts')),
        info.matches.map((m,i)=>React.createElement('div',{key:i,className:'pp-mrow'+(m.minutes===0?' dnp':'')},
          React.createElement('span',{className:'pp-mrow-rd'}, m.round),
          React.createElement('span',{className:'pp-mrow-opp'},
            React.createElement('span',{className:'pp-ha'}, m.home?'H':'A'),
            React.createElement(Flag,{code:m.opp,size:15,round:true}),
            React.createElement('span',{className:'pp-opp-name'}, m.opp),
            React.createElement('span',{className:'pp-res res-'+m.result}, m.score[0]+'–'+m.score[1]),
            cardDot(m)),
          React.createElement('span',{className:'pp-mrow-c num'}, m.minutes===0?'—':m.minutes+"'"),
          React.createElement('span',{className:'pp-mrow-c num'}, m.minutes===0?'—':m.goals),
          React.createElement('span',{className:'pp-mrow-c num'}, m.minutes===0?'—':m.assists),
          React.createElement('span',{className:'pp-mrow-c num'+(m.rating?ratingTone(m.rating):'')}, m.rating?m.rating.toFixed(1):'—'),
          React.createElement('span',{className:'pp-mrow-c pts'},
            React.createElement('span',{className:'pp-fp num'+(m.fantasy>=8?' hot':m.fantasy<=1?' cold':'')}, m.fantasy)))))
    );
  }
  const ratingTone = r => r>=7.5?' r-hi':r>=6.5?' r-mid':' r-lo';

  // ---- upcoming fixtures (difficulty) ----
  function FixturesTab({info}){
    const fdrLab = ['','Very easy','Easy','Even','Hard','Very hard'];
    return React.createElement('div',{className:'pp-tabbody'},
      React.createElement('div',{className:'pp-fixtures'},
        info.upcoming.map((f,i)=>React.createElement('div',{key:i,className:'pp-fix'},
          React.createElement('div',{className:'pp-fix-l'},
            React.createElement('div',{className:'pp-fix-rd'}, f.round, f.live && React.createElement('span',{className:'pp-live'},React.createElement('span',{className:'live-dot'}),'LIVE')),
            React.createElement('div',{className:'pp-fix-when'}, f.tbd?'Projected · '+f.when:f.when)),
          React.createElement('div',{className:'pp-fix-opp'},
            React.createElement('span',{className:'pp-ha'}, f.home?'H':'A'),
            React.createElement(Flag,{code:f.opp,size:18,round:true}),
            React.createElement('span',{className:'pp-opp-name big'}, window.COUNTRY_NAME(f.opp))),
          React.createElement('div',{className:'pp-fdr fdr-'+f.fdr, title:'Fixture difficulty'},
            React.createElement('span',{className:'pp-fdr-n num'}, f.fdr),
            React.createElement('span',{className:'pp-fdr-l'}, fdrLab[f.fdr])))))
    );
  }

  function PlayerProfile({player, onClose}){
    const [tab,setTab] = useState('stats');
    if(!player) return null;
    const info = window.PlayerInfo.get(player);
    return React.createElement(Modal,{open:true, onClose, wide:true},
      React.createElement('div',{className:'pp'},
        React.createElement('button',{className:'pp-close icon-btn', onClick:onClose, 'aria-label':'Close'},
          React.createElement(Icon,{name:'close',size:20})),
        // ---- hero ----
        React.createElement('div',{className:'pp-hero pos-bg-'+player.pos},
          React.createElement(PlayerPhoto,{player}),
          React.createElement('div',{className:'pp-hero-id'},
            React.createElement('div',{className:'pp-hero-top'},
              React.createElement('span',{className:'pos pos-'+player.pos}, player.pos),
              React.createElement(StatusPill,{status:player.status})),
            React.createElement('h2',{className:'pp-name'}, player.name),
            React.createElement('div',{className:'pp-sub'},
              React.createElement(Flag,{code:player.country,size:14,round:true}),
              React.createElement('span',null, info.nationality),
              React.createElement('span',{className:'pp-dot'},'·'),
              React.createElement('span',{className:'muted'}, info.club)),
            React.createElement('div',{className:'pp-price'},
              React.createElement('span',{className:'pp-price-v num'}, '£'+player.price.toFixed(1)+'m'),
              React.createElement('span',{className:'pp-price-l'}, 'GAFFER price')))),
        // ---- vitals ----
        React.createElement('div',{className:'pp-vitals'},
          React.createElement(Vital,{label:'Age', value:info.age}),
          React.createElement(Vital,{label:'Height', value:info.heightCm, sub:'cm'}),
          React.createElement(Vital,{label:'Weight', value:info.weightKg, sub:'kg'}),
          React.createElement(Vital,{label:'Nation', value:player.country})),
        // ---- tabs ----
        React.createElement('div',{className:'pp-tabs'},
          React.createElement(Segmented,{size:'sm', value:tab, onChange:setTab, options:[
            {value:'stats',label:'Statistics'},{value:'matches',label:'Matches'},{value:'fixtures',label:'Fixtures'}]})),
        tab==='stats' && React.createElement(StatsTab,{player, info}),
        tab==='matches' && React.createElement(MatchesTab,{info}),
        tab==='fixtures' && React.createElement(FixturesTab,{info})
      )
    );
  }
  window.PlayerProfile = PlayerProfile;

  // hook: returns [node, open]
  function usePlayerProfile(){
    const [player,setPlayer] = useState(null);
    const node = player && React.createElement(PlayerProfile,{player, onClose:()=>setPlayer(null)});
    return [node, setPlayer];
  }
  window.usePlayerProfile = usePlayerProfile;
})();
