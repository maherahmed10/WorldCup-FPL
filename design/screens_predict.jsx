/* ============================================================
   GAFFER — Predictions / Side Bets + My Bets
   ============================================================ */
(function(){
  const { useState } = React;
  const Icon=window.Icon, Flag=window.Flag, Modal=window.Modal, Segmented=window.Segmented;

  function MatchTitle({m, size=20}){
    return React.createElement('div',{className:'mt'},
      React.createElement(Flag,{code:m[0],size,round:true}),
      React.createElement('span',{className:'mt-vs'}, m[0],' v ',m[1]),
      React.createElement(Flag,{code:m[1],size,round:true}));
  }

  function PredictScreen({balance, setBalance, openBets, setOpenBets, toast}){
    const D=window.GAFFER_DATA;
    const [tab,setTab]=useState('markets');
    const [slip,setSlip]=useState(null); // {match, market, pick, odds}

    function placeBet(stake){
      setOpenBets([{ id:Date.now(), match:slip.match, market:slip.market, pick:slip.pick,
        odds:slip.odds, stake, status:'open', payout: Math.round(stake*slip.odds) }, ...openBets]);
      setBalance(b=>b-stake);
      setSlip(null);
      toast && toast('Bet placed · '+stake+' pts staked','accent');
    }

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Predictions'),
          React.createElement('div',{className:'sub'},'Stake virtual points on match markets for bonus points. No real money.')),
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
            D.MARKETS.map((mk,i)=>React.createElement('div',{key:i,className:'match-card'},
              React.createElement('div',{className:'match-card-head'},
                React.createElement(MatchTitle,{m:mk.match}),
                React.createElement('span',{className:'muted',style:{fontSize:13}}, mk.time)),
              mk.markets.map((g,j)=>React.createElement('div',{key:j,className:'market-group'},
                React.createElement('div',{className:'market-label'}, g.label),
                React.createElement('div',{className:'market-opts'},
                  g.opts.map((o,k)=>React.createElement('button',{key:k,className:'odd-btn',
                    onClick:()=>setSlip({match:mk.match, market:g.label, pick:o.name, odds:o.odds})},
                    React.createElement('span',{className:'odd-name'}, o.name),
                    React.createElement('span',{className:'odd-val num'}, o.odds.toFixed(2)))))))
            )))
        : React.createElement(MyBets,{openBets}),

      slip && React.createElement(BetSlip,{slip, balance, onClose:()=>setSlip(null), onPlace:placeBet})
    );
  }

  function BetSlip({slip, balance, onClose, onPlace}){
    const [stake,setStake]=useState(50);
    const ret = Math.round(stake*slip.odds);
    const profit = ret-stake;
    const tooHigh = stake>balance;
    return React.createElement(Modal,{open:true,onClose,title:'Place Bet'},
      React.createElement('div',{className:'slip'},
        React.createElement('div',{className:'slip-match'}, React.createElement(MatchTitle,{m:slip.match,size:18})),
        React.createElement('div',{className:'slip-pick'},
          React.createElement('div',null,
            React.createElement('div',{className:'slip-market'}, slip.market),
            React.createElement('div',{className:'slip-sel'}, slip.pick)),
          React.createElement('span',{className:'pill pill-blue num'}, slip.odds.toFixed(2))),
        React.createElement('div',{className:'slip-stake'},
          React.createElement('label',null,'Stake (points)'),
          React.createElement('div',{className:'stake-input'},
            React.createElement(Icon,{name:'coins',size:18,style:{color:'var(--gold)'}}),
            React.createElement('input',{type:'number',value:stake,min:1,max:balance,
              onChange:e=>setStake(Math.max(0,Math.min(balance,+e.target.value||0)))})),
          React.createElement('div',{className:'stake-chips'},
            [25,50,100,balance].map((v,i)=>React.createElement('button',{key:i,className:'schip',
              onClick:()=>setStake(v)}, i===3?'Max':v)))),
        React.createElement('div',{className:'slip-return'},
          React.createElement('div',{className:'sr'},
            React.createElement('span',{className:'muted'},'Potential return'),
            React.createElement('span',{className:'num sr-big tone-accent'}, ret)),
          React.createElement('div',{className:'sr'},
            React.createElement('span',{className:'muted'},'Profit'),
            React.createElement('span',{className:'num'}, '+'+profit))),
        tooHigh && React.createElement('div',{className:'vmsg err',style:{marginBottom:12}},
          React.createElement('span',{className:'ic'},React.createElement(Icon,{name:'info',size:15})),'Stake exceeds your balance.'),
        React.createElement('button',{className:'btn btn-primary btn-block',disabled:tooHigh||stake<1,
          onClick:()=>onPlace(stake)}, 'Confirm Bet · '+stake+' pts'))
    );
  }

  function MyBets({openBets}){
    const D=window.GAFFER_DATA;
    const settled = D.SETTLED_BETS;
    if(!openBets.length && !settled.length){
      return React.createElement('div',{className:'empty'},
        React.createElement('div',{className:'empty-ico'},React.createElement(Icon,{name:'predictions',size:26})),
        React.createElement('h3',null,'No bets yet'),
        React.createElement('p',null,'Head to Markets and stake some points on an upcoming match.'));
    }
    const Bet = ({b})=>React.createElement('div',{className:'bet-row '+b.status},
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
    return React.createElement('div',null,
      openBets.length>0 && React.createElement('div',null,
        React.createElement('div',{className:'sum-title',style:{margin:'4px 0 10px'}},'Open bets'),
        openBets.map(b=>React.createElement(Bet,{key:b.id,b}))),
      React.createElement('div',{className:'sum-title',style:{margin:'18px 0 10px'}},'Settled'),
      settled.map(b=>React.createElement(Bet,{key:b.id,b})));
  }

  window.PredictScreen = PredictScreen;
})();
