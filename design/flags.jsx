/* ============================================================
   GAFFER — country flags. Simplified, recognizable SVG flags.
   Flag({code, size, round}) — size = height in px (3:2 ratio).
   ============================================================ */
(function(){
  // Each entry returns SVG inner markup drawn in a 60x40 viewBox.
  const R = React.createElement;
  const rect = (x,y,w,h,f,key) => R('rect',{key,x,y,width:w,height:h,fill:f});
  const circle= (cx,cy,r,f,key) => R('circle',{key,cx,cy,r,fill:f});

  // simple 5-point star path centered at cx,cy radius r
  function starPath(cx,cy,r){
    let pts=[]; for(let i=0;i<5;i++){
      const a=-Math.PI/2 + i*2*Math.PI/5; pts.push([cx+r*Math.cos(a), cy+r*Math.sin(a)]);
      const a2=a+Math.PI/5; pts.push([cx+r*0.42*Math.cos(a2), cy+r*0.42*Math.sin(a2)]);
    }
    return pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')+'Z';
  }

  const FLAGS = {
    BRA:()=>[rect(0,0,60,40,'#1B9E4B','b'),R('path',{key:'d',d:'M30 4 L56 20 L30 36 L4 20 Z',fill:'#FFD000'}),circle(30,20,8,'#0A2A8C','c')],
    FRA:()=>[rect(0,0,20,40,'#1B3A8C','a'),rect(20,0,20,40,'#fff','b'),rect(40,0,20,40,'#E11D2E','c')],
    ITA:()=>[rect(0,0,20,40,'#1B8A4B','a'),rect(20,0,20,40,'#fff','b'),rect(40,0,20,40,'#E11D2E','c')],
    MEX:()=>[rect(0,0,20,40,'#0E7A3C','a'),rect(20,0,20,40,'#fff','b'),rect(40,0,20,40,'#D1182B','c'),circle(30,20,4,'#7a5c2e','e')],
    BEL:()=>[rect(0,0,20,40,'#16161A','a'),rect(20,0,20,40,'#FFD500','b'),rect(40,0,20,40,'#E2353C','c')],
    SEN:()=>[rect(0,0,20,40,'#0E8A3C','a'),rect(20,0,20,40,'#FFD500','b'),rect(40,0,20,40,'#D1182B','c'),R('path',{key:'s',d:starPath(30,20,6),fill:'#0E8A3C'})],
    ENG:()=>[rect(0,0,60,40,'#fff','b'),rect(26,0,8,40,'#E11D2E','v'),rect(0,16,60,8,'#E11D2E','h')],
    GER:()=>[rect(0,0,60,13.3,'#16161A','a'),rect(0,13.3,60,13.3,'#E11D2E','b'),rect(0,26.6,60,13.4,'#FFCE00','c')],
    NED:()=>[rect(0,0,60,13.3,'#C8102E','a'),rect(0,13.3,60,13.3,'#fff','b'),rect(0,26.6,60,13.4,'#1B3A8C','c')],
    ARG:()=>[rect(0,0,60,13.3,'#74ACDF','a'),rect(0,13.3,60,13.3,'#fff','b'),rect(0,26.6,60,13.4,'#74ACDF','c'),circle(30,20,4.4,'#F6B40E','s')],
    JPN:()=>[rect(0,0,60,40,'#fff','b'),circle(30,20,9,'#BC002D','c')],
    POR:()=>[rect(0,0,24,40,'#0E6B3C','a'),rect(24,0,36,40,'#D1182B','b'),circle(24,20,6,'#FFD000','c')],
    ESP:()=>[rect(0,0,60,10,'#C60B1E','a'),rect(0,10,60,20,'#FFC400','b'),rect(0,30,60,10,'#C60B1E','c')],
    CRO:()=>[rect(0,0,60,13.3,'#C8102E','a'),rect(0,13.3,60,13.3,'#fff','b'),rect(0,26.6,60,13.4,'#1B3A8C','c'),
      rect(25,13,10,10,'#fff','sq'),rect(25,13,5,5,'#C8102E','q1'),rect(30,18,5,5,'#C8102E','q2')],
    USA:()=>{const els=[]; for(let i=0;i<7;i++)els.push(rect(0,i*5.7,60,2.85,'#B22234','s'+i));
      els.push(rect(0,0,26,20,'#3C3B6E','canton'));
      for(let r=0;r<3;r++)for(let c=0;c<5;c++)els.push(circle(4+c*5,4+r*6,0.9,'#fff','st'+r+c));
      return els;},
    CAN:()=>[rect(0,0,15,40,'#D1182B','a'),rect(45,0,15,40,'#D1182B','b'),
      R('path',{key:'leaf',d:'M30 9 l2.4 5.2 5.4-1.2-2 4.4 4.2 3-4.6 1.8 1 5.4-4.6-2.8-1.2 3.2-1.2-3.2-4.6 2.8 1-5.4-4.6-1.8 4.2-3-2-4.4 5.4 1.2z',fill:'#D1182B'})],
    MAR:()=>[rect(0,0,60,40,'#C60B1E','b'),R('path',{key:'s',d:starPath(30,20,8),fill:'none',stroke:'#0E6B3C',strokeWidth:1.6})],
    URU:()=>{const els=[rect(0,0,60,40,'#fff','b')]; for(let i=0;i<4;i++)els.push(rect(24,4.5+i*9,36,4.5,'#0E55B0','s'+i));
      els.push(rect(0,0,24,22.5,'#fff','c'),circle(12,11,4,'#F6B40E','sun')); return els;},
    AUS:()=>[rect(0,0,60,40,'#1B3A8C','b'),rect(0,0,24,18,'#16306E','c'),
      rect(6,2,12,2,'#fff','x1'),rect(11,-1,2,12,'#fff','x2'),
      R('path',{key:'st',d:starPath(40,26,3.4),fill:'#fff'}),R('path',{key:'st2',d:starPath(12,33,2.2),fill:'#fff'})],
  };

  function Flag({code, size=18, round=false, style}){
    const w = size*1.5, h = size;
    const draw = FLAGS[code];
    const clipId = 'fc_'+code+'_'+(round?'r':'s');
    return R('span',{className:'flag', style:Object.assign({display:'inline-flex',flex:'0 0 auto',lineHeight:0,
        borderRadius: round? '50%':'3px', overflow:'hidden', boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.18)',
        width: round? h+'px': w+'px', height: h+'px'}, style)},
      R('svg',{width: round? h:w, height:h, viewBox: round? '8 0 40 40':'0 0 60 40', preserveAspectRatio:'xMidYMid slice'},
        draw ? draw() : [rect(0,0,60,40,'#2A3649','x'), R('text',{key:'t',x:30,y:25,fill:'#97A4B6',fontSize:14,textAnchor:'middle',fontFamily:'sans-serif'},code)]
      )
    );
  }
  window.Flag = Flag;
  window.COUNTRY_NAME = code => (window.GAFFER_DATA?.COUNTRIES?.[code]?.name) || code;
})();
