/* ============================================================
   GAFFER — Predictions / Markets + Parlay bet slip + My Bets
   ============================================================ */
(function(){
  const { useState, useMemo } = React;
  const Icon=window.Icon, Flag=window.Flag, Modal=window.Modal, Segmented=window.Segmented;
  const BetData=window.BetData;

  const RESULT_KEYS = new Set(['1x2','ou','btts']);   // mutually-exclusive grids
  const RESULT_KEYS_BY_LABEL = new Set(['Match Result','Over / Under 2.5 Goals','Both Teams To Score']);
  const PLAYER_TYPES = ['scorer','assist','card'];     // 2-col team markets
  const legKey = (match,market,pick)=> match.join('')+'|'+market+'|'+pick;

  function MatchTitle({m, size=20}){
    return React.createElement('div',{className:'mt'},
      React.createElement(Flag,{code:m[0],size,round:true}),
      React.createElement('span',{className:'mt-vs'}, m[0],' v ',m[1]),
      React.createElement(Flag,{code:m[1],size,round:true}));
  }

  // ---------- one player market: each team a ROW of [3 players] + [+ Other] ----------
  function PlayerMarket({match, type, custom, onUnpick, legs, toggleLeg, openPicker}){
    const label = BetData.LABELS[type];
    const inLegs = name => legs.some(l=>l.key===legKey(match,label,name));
    const cell = (team, o, isCustom)=>React.createElement('button',{key:o.name,
        className:'odd-btn'+(inLegs(o.name)?' on':'')+(isCustom?' custom':''),
        onClick:()=>toggleLeg({key:legKey(match,label,o.name), match, market:label, pick:o.name, odds:o.odds})},
      React.createElement('span',{className:'odd-name'}, o.name),
      React.createElement('span',{className:'odd-vwrap'},
        React.createElement('span',{className:'odd-val num'}, o.odds.toFixed(2)),
        isCustom && React.createElement('span',{className:'odd-x',title:'Remove',
          onClick:e=>{ e.stopPropagation(); onUnpick(team,type,o.name); }},
          React.createElement(Icon,{name:'close',size:13}))));
    const Row = (team)=>{
      const top = BetData.market(team, type).slice(0,3);
      const picks = custom[match.join('')+':'+type+':'+team]||[];
      return React.createElement('div',{className:'pmarket-row', key:team},
        top.map(o=>cell(team,o,false)),
        picks.map(o=>cell(team,o,true)),
        React.createElement('button',{className:'odd-btn odd-more',
            onClick:()=>openPicker({match, team, type, label})},
          React.createElement(Icon,{name:'plus',size:14}),
          React.createElement('span',{className:'odd-name'}, 'Other '+window.COUNTRY_NAME(team))));
    };
    return React.createElement('div',{className:'market-group'},
      React.createElement('div',{className:'market-label'}, label),
      Row(match[0]), Row(match[1]));
  }

  // ---------- "pick another player" modal (team-scoped) ----------
  function PlayerPickerModal({ctx, custom, onChoose, onClose}){
    const { match, team, type, label } = ctx;
    const fxKey = match.join('');
    const [q,setQ]=useState('');
    const shownNames = new Set([
      ...BetData.market(team,type).slice(0,3).map(o=>o.name),
      ...(custom[fxKey+':'+type+':'+team]||[]).map(o=>o.name),
    ]);
    const list = BetData.market(team,type)
      .filter(o=>!shownNames.has(o.name))
      .filter(o=>!q.trim() || o.name.toLowerCase().includes(q.toLowerCase()));
    return React.createElement(Modal,{open:true,onClose,title:label+' · '+window.COUNTRY_NAME(team)},
      React.createElement('div',{style:{padding:'4px 16px 16px'}},
        React.createElement('div',{className:'search',style:{marginBottom:10}},
          React.createElement(Icon,{name:'search',size:18,style:{color:'var(--text-3)'}}),
          React.createElement('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Search '+window.COUNTRY_NAME(team)+' squad…'})),
        React.createElement('div',{className:'picker-odds'},
          list.length===0
            ? React.createElement('div',{className:'picker-empty'},'No more players match.')
            : list.map(o=>React.createElement('button',{key:o.name,className:'bodd',
                onClick:()=>onChoose(team,type,o)},
                React.createElement('span',{className:'bodd-l'},
                  React.createElement('span',{className:'pos pos-'+o.pos}, o.pos),
                  React.createElement('span',{className:'bodd-name'}, o.name)),
                React.createElement('span',{className:'bodd-val num'}, o.odds.toFixed(2)))))));
  }

  // ---------- Parlay bet slip (floating) ----------
  function BetSlip({legs, balance, open, setOpen, removeLeg, clear, onPlaceParlay, onPlaceSingles}){
    const [mode,setMode]=useState('parlay');
    const [stake,setStake]=useState(50);
    const combo = useMemo(()=> legs.reduce((p,l)=>p*l.odds,1), [legs]);
    if(legs.length===0) return null;
    const multi = legs.length>1;
    const effMode = multi? mode : 'parlay';
    const maxStake = effMode==='singles' ? Math.floor(balance/legs.length) : balance;
    const totalStake = effMode==='singles' ? stake*legs.length : stake;
    const ret = effMode==='singles'
      ? legs.reduce((s,l)=>s+Math.round(stake*l.odds),0)
      : Math.round(stake*combo);
    const tooHigh = totalStake>balance || stake<1;

    if(!open){
      return React.createElement('button',{className:'slip-pill',onClick:()=>setOpen(true)},
        React.createElement('span',{className:'slip-pill-ico'},React.createElement(Icon,{name:'ball',size:18})),
        React.createElement('span',null, legs.length+(multi?' selections':' selection')),
        React.createElement('span',{className:'slip-pill-odds num'}, '@'+combo.toFixed(2)));
    }
    return React.createElement('div',{className:'slip-panel'},
      React.createElement('div',{className:'slip-panel-head'},
        React.createElement('div',{className:'row',style:{gap:8}},
          React.createElement(Icon,{name:'ball',size:18,style:{color:'var(--accent)'}}),
          React.createElement('b',null,'Bet Slip'),
          React.createElement('span',{className:'pill'}, legs.length)),
        React.createElement('div',{className:'row',style:{gap:4}},
          React.createElement('button',{className:'slip-clear',onClick:clear},'Clear'),
          React.createElement('button',{className:'icon-btn',onClick:()=>setOpen(false)},
            React.createElement(Icon,{name:'chevdown',size:18})))),
      multi && React.createElement('div',{style:{padding:'10px 14px 0'}},
        React.createElement(Segmented,{size:'sm',value:mode,onChange:setMode,
          options:[{value:'parlay',label:'Parlay'},{value:'singles',label:'Singles'}]})),
      React.createElement('div',{className:'slip-legs'},
        legs.map(l=>React.createElement('div',{className:'slip-leg',key:l.key},
          React.createElement('div',{className:'slip-leg-id'},
            React.createElement('div',{className:'slip-leg-pick'}, l.pick),
            React.createElement('div',{className:'slip-leg-mkt'}, l.match.join(' v ')+' · '+l.market)),
          React.createElement('span',{className:'slip-leg-odds num'}, l.odds.toFixed(2)),
          React.createElement('button',{className:'slip-leg-x',onClick:()=>removeLeg(l.key)},
            React.createElement(Icon,{name:'close',size:14}))))),
      React.createElement('div',{className:'slip-foot'},
        effMode==='parlay' && multi && React.createElement('div',{className:'slip-combo'},
          React.createElement('span',{className:'muted'}, legs.length+'-leg parlay'),
          React.createElement('span',{className:'num slip-combo-odds'}, '@'+combo.toFixed(2))),
        React.createElement('div',{className:'stake-input'},
          React.createElement(Icon,{name:'coins',size:17,style:{color:'var(--gold)'}}),
          React.createElement('input',{type:'number',value:stake,min:1,max:maxStake,
            onChange:e=>setStake(Math.max(0,Math.min(maxStake,+e.target.value||0)))}),
          React.createElement('span',{className:'stake-suffix'}, effMode==='singles'?'/ leg':'stake')),
        React.createElement('div',{className:'stake-chips'},
          [25,50,100,maxStake].map((v,i)=>React.createElement('button',{key:i,className:'schip',
            onClick:()=>setStake(v)}, i===3?'Max':v))),
        React.createElement('div',{className:'slip-return'},
          React.createElement('div',{className:'sr'},
            React.createElement('span',{className:'muted'}, effMode==='singles'?'Total return (if all win)':'Potential return'),
            React.createElement('span',{className:'num sr-big tone-accent'}, ret))),
        tooHigh && React.createElement('div',{className:'vmsg err',style:{margin:'0 0 10px'}},
          React.createElement('span',{className:'ic'},React.createElement(Icon,{name:'info',size:15})),
          stake<1?'Enter a stake.':'Total stake exceeds balance.'),
        React.createElement('button',{className:'btn btn-primary btn-block',disabled:tooHigh,
          onClick:()=> effMode==='singles'? onPlaceSingles(stake) : onPlaceParlay(stake, combo)},
          effMode==='singles'
            ? ('Place '+legs.length+' singles · '+totalStake+' pts')
            : (multi? ('Place parlay · '+stake+' pts') : ('Place bet · '+stake+' pts')))));
  }

  function PredictScreen({balance, setBalance, openBets, setOpenBets, toast}){
    const D=window.GAFFER_DATA;
    const [tab,setTab]=useState('markets');
    const [expanded,setExpanded]=useState(0);     // accordion: open fixture index
    const [legs,setLegs]=useState([]);
    const [slipOpen,setSlipOpen]=useState(true);
    const [custom,setCustom]=useState({});         // injected "other" picks
    const [picker,setPicker]=useState(null);

    function toggleLeg(leg){
      setLegs(prev=>{
        if(prev.some(l=>l.key===leg.key)) return prev.filter(l=>l.key!==leg.key);
        let next = prev;
        if(RESULT_KEYS_BY_LABEL.has(leg.market)) // one pick per fixture+result-market
          next = prev.filter(l=>!(l.match.join('')===leg.match.join('') && l.market===leg.market));
        setSlipOpen(true);
        return [...next, leg];
      });
    }
    const removeLeg = key => setLegs(prev=>prev.filter(l=>l.key!==key));
    const clearLegs = () => setLegs([]);

    function choosePlayer(team,type,o){
      const k = picker.match.join('')+':'+type+':'+team;
      setCustom(prev=> ({...prev, [k]: [...(prev[k]||[]), o]}));
      toggleLeg({key:legKey(picker.match,BetData.LABELS[type],o.name), match:picker.match,
        market:BetData.LABELS[type], pick:o.name, odds:o.odds});
      setPicker(null);
    }
    function unpickFor(match,team,type,name){
      const k = match.join('')+':'+type+':'+team;
      setCustom(prev=>({...prev, [k]: (prev[k]||[]).filter(o=>o.name!==name)}));
      removeLeg(legKey(match,BetData.LABELS[type],name));
    }

    function placeParlay(stake, combo){
      setOpenBets([{ id:Date.now(), parlay:true, legs:legs.slice(), odds:combo,
        market:legs.length+'-leg Parlay', pick:legs.map(l=>l.pick).join(', '),
        match:legs[0].match, stake, status:'open', payout:Math.round(stake*combo) }, ...openBets]);
      setBalance(b=>b-stake); clearLegs();
      toast && toast('Parlay placed · '+stake+' pts','accent');
    }
    function placeSingles(stakeEach){
      const bets = legs.map((l,i)=>({ id:Date.now()+i, match:l.match, market:l.market, pick:l.pick,
        odds:l.odds, stake:stakeEach, status:'open', payout:Math.round(stakeEach*l.odds) }));
      setOpenBets([...bets, ...openBets]);
      setBalance(b=>b-stakeEach*legs.length); clearLegs();
      toast && toast(bets.length+' singles placed','accent');
    }

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Predictions'),
          React.createElement('div',{className:'sub'},'Stake virtual points on match markets. Build singles or parlays.')),
        React.createElement('div',{className:'balance-chip'},
          React.createElement(Icon,{name:'coins',size:18,style:{color:'var(--gold)'}}),
          React.createElement('div',null,
            React.createElement('div',{className:'bc-num num'}, balance),
            React.createElement('div',{className:'bc-lab'},'points balance')))),

      React.createElement('div',{style:{margin:'4px 0 18px'}},
        React.createElement(Segmented,{value:tab,onChange:setTab,
          options:[{value:'markets',label:'Markets'},{value:'mybets',label:'My Bets'}]})),

      tab==='markets'
        ? React.createElement('div',{className:'markets'},
            D.MARKETS.map((mk,i)=>{
              const isOpen = expanded===i;
              return React.createElement('div',{key:i,className:'match-card'+(isOpen?' open':'')},
                React.createElement('button',{className:'match-card-head',onClick:()=>setExpanded(isOpen?-1:i)},
                  React.createElement(MatchTitle,{m:mk.match}),
                  React.createElement('div',{className:'row',style:{gap:10}},
                    React.createElement('span',{className:'muted',style:{fontSize:13}}, mk.time),
                    React.createElement(Icon,{name:'chevdown',size:18,className:'mc-chev',style:{color:'var(--text-3)'}}))),
                isOpen && React.createElement('div',{className:'match-card-body'},
                  mk.markets.filter(g=>RESULT_KEYS.has(g.key)).map((g,j)=>
                    React.createElement('div',{key:j,className:'market-group'},
                      React.createElement('div',{className:'market-label'}, g.label),
                      React.createElement('div',{className:'market-opts'},
                        g.opts.map((o,k)=>{
                          const k2=legKey(mk.match,g.label,o.name);
                          return React.createElement('button',{key:k,className:'odd-btn'+(legs.some(l=>l.key===k2)?' on':''),
                            onClick:()=>toggleLeg({key:k2, match:mk.match, market:g.label, pick:o.name, odds:o.odds})},
                            React.createElement('span',{className:'odd-name'}, o.name),
                            React.createElement('span',{className:'odd-val num'}, o.odds.toFixed(2)));
                        }))),
                  ),
                  PLAYER_TYPES.map(t=>React.createElement(PlayerMarket,{key:t, match:mk.match, type:t,
                    custom, legs, toggleLeg, openPicker:setPicker,
                    onUnpick:(team,ty,name)=>unpickFor(mk.match,team,ty,name)}))
                ));
            }))
        : React.createElement(MyBets,{openBets}),

      picker && React.createElement(PlayerPickerModal,{ctx:picker, custom,
        onChoose:choosePlayer, onClose:()=>setPicker(null)}),

      tab==='markets' && React.createElement(BetSlip,{legs, balance, open:slipOpen, setOpen:setSlipOpen,
        removeLeg, clear:clearLegs, onPlaceParlay:placeParlay, onPlaceSingles:placeSingles})
    );
  }

  function MyBets({openBets}){
    const D=window.GAFFER_DATA;
    const settled = D.SETTLED_BETS;
    if(!openBets.length && !settled.length){
      return React.createElement('div',{className:'empty'},
        React.createElement('div',{className:'empty-ico'},React.createElement(Icon,{name:'predictions',size:26})),
        React.createElement('h3',null,'No bets yet'),
        React.createElement('p',null,'Head to Markets and build a single or a parlay.'));
    }
    const Bet = ({b})=>{
      if(b.parlay){
        return React.createElement('div',{className:'bet-row '+b.status},
          React.createElement('div',{className:'bet-main'},
            React.createElement('div',{className:'row',style:{gap:8}},
              React.createElement('span',{className:'pill pill-gold'},React.createElement(Icon,{name:'ball',size:12}),' '+b.legs.length+'-leg Parlay'),
              React.createElement('span',{className:'muted num',style:{fontSize:12}}, '@'+b.odds.toFixed(2))),
            React.createElement('div',{className:'parlay-legs'},
              b.legs.map((l,i)=>React.createElement('div',{key:i,className:'parlay-leg'},
                React.createElement('span',{className:'pl-tick'},React.createElement(Icon,{name:'check',size:11})),
                React.createElement('span',{className:'pl-pick'}, l.pick),
                React.createElement('span',{className:'muted',style:{fontSize:11}}, l.match.join(' v '))))) ),
          React.createElement('div',{className:'bet-nums'},
            React.createElement('div',{className:'bet-stake'},
              React.createElement('span',{className:'num'}, b.stake)),
            React.createElement('span',{className:'bet-status status-'+b.status},
              b.status==='open'?('→ '+b.payout): b.status==='won'? '+'+b.payout : 'Lost')));
      }
      return React.createElement('div',{className:'bet-row '+b.status},
        React.createElement('div',{className:'bet-main'},
          React.createElement(MatchTitle,{m:b.match,size:16}),
          React.createElement('div',{className:'bet-info'},
            React.createElement('span',{className:'bet-pick'}, b.pick),
            React.createElement('span',{className:'muted'}, b.market))),
        React.createElement('div',{className:'bet-nums'},
          React.createElement('div',{className:'bet-stake'},
            React.createElement('span',{className:'num'}, b.stake),
            React.createElement('span',{className:'bet-odds num'}, '@'+b.odds.toFixed(2))),
          React.createElement('span',{className:'bet-status status-'+b.status},
            b.status==='open'?'Open': b.status==='won'? '+'+b.payout : 'Lost')));
    };
    return React.createElement('div',null,
      openBets.length>0 && React.createElement('div',null,
        React.createElement('div',{className:'sum-title',style:{margin:'4px 0 10px'}},'Open bets'),
        openBets.map(b=>React.createElement(Bet,{key:b.id,b}))),
      React.createElement('div',{className:'sum-title',style:{margin:'18px 0 10px'}},'Settled'),
      settled.map(b=>React.createElement(Bet,{key:b.id,b})));
  }

  window.PredictScreen = PredictScreen;
})();
