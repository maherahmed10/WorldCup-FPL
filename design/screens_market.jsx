/* ============================================================
   GAFFER — Players / Transfer Market
   ============================================================ */
(function(){
  const { useState, useEffect } = React;
  const Icon=window.Icon, Flag=window.Flag, FilterBar=window.FilterBar,
        usePlayerFilter=window.usePlayerFilter, Spark=window.Spark, Segmented=window.Segmented;

  function Skeleton(){
    return React.createElement('div',{className:'market-table'},
      Array.from({length:9}).map((_,i)=>React.createElement('div',{key:i,className:'mrow skel-row'},
        React.createElement('div',{className:'skel',style:{width:30,height:30,borderRadius:'50%'}}),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{className:'skel',style:{width:'45%',height:13,marginBottom:7}}),
          React.createElement('div',{className:'skel',style:{width:'30%',height:10}})),
        React.createElement('div',{className:'skel',style:{width:46,height:18}}),
        React.createElement('div',{className:'skel',style:{width:40,height:18}}))));
  }

  function MarketScreen(){
    const D=window.GAFFER_DATA;
    const { list, props } = usePlayerFilter('ALL');
    const [view,setView]=useState('table');
    const [loading,setLoading]=useState(true);
    useEffect(()=>{ const t=setTimeout(()=>setLoading(false),900); return ()=>clearTimeout(t); },[]);

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Players'),
          React.createElement('div',{className:'sub'},D.PLAYERS.length+' players · scout the market by points, form and price')),
        React.createElement(Segmented,{size:'sm',value:view,onChange:setView,options:[{value:'table',label:'List'},{value:'grid',label:'Cards'}]})),

      React.createElement(FilterBar, Object.assign({}, props, {setMaxPrice:props.setMaxPrice})),

      loading ? React.createElement(Skeleton)
      : list.length===0 ? React.createElement('div',{className:'empty',style:{marginTop:18}},
          React.createElement('div',{className:'empty-ico'},React.createElement(Icon,{name:'search',size:26})),
          React.createElement('h3',null,'No players found'),
          React.createElement('p',null,'Try widening the price range or clearing a filter.'))
      : view==='table'
        ? React.createElement('div',{className:'market-table',style:{marginTop:14}},
            React.createElement('div',{className:'mrow mhead'},
              React.createElement('span',{style:{flex:1}},'Player'),
              React.createElement('span',{className:'mcol'},'Form'),
              React.createElement('span',{className:'mcol'},'PPG'),
              React.createElement('span',{className:'mcol'},'Pts'),
              React.createElement('span',{className:'mcol'},'Price')),
            list.map(p=>React.createElement('div',{key:p.id,className:'mrow'},
              React.createElement('div',{className:'mflag'},React.createElement(Flag,{code:p.country,size:22,round:true})),
              React.createElement('div',{className:'mid'},
                React.createElement('div',{className:'mname'}, p.name,
                  p.status==='doubt'&&React.createElement('span',{className:'dot-doubt'})),
                React.createElement('div',{className:'mmeta'},
                  React.createElement('span',{className:'pos pos-'+p.pos},p.pos),
                  React.createElement('span',{className:'muted'},window.COUNTRY_NAME(p.country)),
                  React.createElement('span',{className:'muted dim'},p.selBy+'%'))),
              React.createElement('div',{className:'mcol spark'},React.createElement(Spark,{data:p.form})),
              React.createElement('div',{className:'mcol num'},p.ppg.toFixed(1)),
              React.createElement('div',{className:'mcol num strong'},p.pts),
              React.createElement('div',{className:'mcol num price'},'£'+p.price.toFixed(1))))
          )
        : React.createElement('div',{className:'market-grid',style:{marginTop:14}},
            list.map(p=>React.createElement('div',{key:p.id,className:'pcard'},
              React.createElement('div',{className:'pcard-top'},
                React.createElement(Flag,{code:p.country,size:24,round:true}),
                React.createElement('span',{className:'pos pos-'+p.pos},p.pos),
                React.createElement('span',{className:'pcard-price num'},'£'+p.price.toFixed(1))),
              React.createElement('div',{className:'pcard-name'}, p.name),
              React.createElement('div',{className:'pcard-country muted'}, window.COUNTRY_NAME(p.country)),
              React.createElement('div',{className:'pcard-stats'},
                React.createElement('div',null,React.createElement('div',{className:'pc-num num'},p.pts),React.createElement('div',{className:'pc-lab'},'pts')),
                React.createElement('div',null,React.createElement('div',{className:'pc-num num'},p.ppg.toFixed(1)),React.createElement('div',{className:'pc-lab'},'ppg')),
                React.createElement('div',{className:'pc-spark'},React.createElement(Spark,{data:p.form,w:54}))))))
    );
  }
  window.MarketScreen = MarketScreen;
})();
