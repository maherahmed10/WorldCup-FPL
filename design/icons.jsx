/* ============================================================
   GAFFER — icon set. Outline, 1.6 stroke, 24x24, currentColor.
   Icon({name, size, stroke})
   ============================================================ */
(function(){
  const P = {
    team:'M8 4l-4 2 1.5 3L8 8v12h8V8l2.5 1L20 6l-4-2a4 4 0 01-8 0z',
    players:'M3 6h7v5H3zM14 6h7v5h-7zM3 13h7v5H3zM14 13h7v5h-7z',
    predictions:'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10zm0 4a1 1 0 100 2 1 1 0 000-2z',
    leagues:'M7 4h10v3a5 5 0 01-10 0zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M9 13c0 2 1 3 3 3s3-1 3-3M12 16v3M8 21h8M10 19h4',
    fixtures:'M4 6h16v14H4zM4 9h16M8 4v3M16 4v3M8 13h2M14 13h2M8 16h2M14 16h2',
    search:'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
    filter:'M4 5h16l-6 7v6l-4 2v-8z',
    close:'M6 6l12 12M18 6L6 18',
    chevdown:'M6 9l6 6 6-6',
    chevright:'M9 6l6 6-6 6',
    chevleft:'M15 6l-6 6 6 6',
    plus:'M12 5v14M5 12h14',
    check:'M5 12l5 5 9-10',
    clock:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2',
    bolt:'M13 3L5 13h5l-1 8 8-10h-5z',
    info:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8h.01',
    lock:'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
    unlock:'M6 11h12v9H6zM8 11V8a4 4 0 017-2.5',
    star:'M12 3l2.6 5.6L21 9.3l-4.5 4.2 1.1 6L12 16.9 6.4 19.5l1.1-6L3 9.3l6.4-.7z',
    sort:'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3',
    arrowup:'M12 19V5M12 5l-6 6M12 5l6 6',
    arrowdown:'M12 5v14M12 19l-6-6M12 19l6-6',
    settings:'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .5a7 7 0 00-1.7-1L16 5h-4l-.3 2.5a7 7 0 00-1.7 1L8 8 5 9l1 3-1.5 1.3.5 2.7L8 16a7 7 0 001.7 1l.3 2h4l.3-2a7 7 0 001.7-1l2.2.6 1.3-2.6z',
    menu:'M4 7h16M4 12h16M4 17h16',
    trophy:'M7 4h10v4a5 5 0 01-10 0zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M10 14h4l1 4H9z',
    ball:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7l3.2 2.3-1.2 3.7h-4l-1.2-3.7z',
    swap:'M7 7h11l-3-3M17 17H6l3 3',
    coins:'M8 8a5 3 0 1010 0 5 3 0 10-10 0zM8 8v5a5 3 0 0010 0V8M4 12a5 3 0 0010 0',
    flag:'M5 3v18M5 4h12l-2 4 2 4H5',
    user:'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21a8 8 0 0116 0',
    bell:'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6zM10 21h4',
    google:'M21 12.2c0-.7-.06-1.2-.2-1.8H12v3.4h5.1a4.4 4.4 0 01-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-6.9z M12 22c2.5 0 4.6-.8 6.1-2.2l-3-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H3.8v2.4A9 9 0 0012 22z M6.9 14.6a5.4 5.4 0 010-3.4V8.8H3.8a9 9 0 000 8.1z M12 6.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 003.8 8.8l3.1 2.4C7.6 8.9 9.6 6.6 12 6.6z',
    apple:'M16 13c0-2.5 2-3.5 2-3.5s-1-1.5-3-1.5c-1.5 0-2.2.8-3 .8s-1.5-.8-2.8-.8C8 8 6 9.8 6 13c0 3 2 6 3.5 6 .9 0 1.3-.6 2.5-.6s1.6.6 2.5.6c1.6 0 3.5-3.5 3.5-6zM13 5.5c.7-.9.6-2 .6-2s-1.2 0-2 .9c-.7.8-.7 1.9-.6 2 0 0 1.3.1 2-.9z',
    grip:'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z',
  };
  const FILLED = { google:true, apple:true };
  function Icon({name, size=22, stroke=1.7, style, className}){
    const d = P[name];
    const filled = FILLED[name];
    return React.createElement('svg',{width:size,height:size,viewBox:'0 0 24 24',
      fill: filled?'currentColor':'none', stroke: filled?'none':'currentColor',
      strokeWidth: filled?0:stroke, strokeLinecap:'round', strokeLinejoin:'round',
      className, style:Object.assign({flex:'0 0 auto'},style)},
      React.createElement('path',{d}));
  }
  window.Icon = Icon;
})();
