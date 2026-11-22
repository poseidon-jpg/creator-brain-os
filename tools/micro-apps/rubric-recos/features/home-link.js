/* RoboHome - the "back to home" button. One file, no dependencies, works from file:// and http.
   Every hub, review page and inner app page starts its header with an arrow plus "Home", so you never need the browser's
   back button or a typed URL. Home is the app's own homepage, or the Agentic OS for a standalone page.

   Use:
     <header class="top">...</header>
     <script src="home-link.js"></script>
     <script>RoboHome.init({ mount:'header.top' });</script>                       (Agentic OS by default)
     <script>RoboHome.init({ mount:'header', href:'/', title:'RUBRIC Carousels' });</script>   (an app's homepage)
   It goes in as the first thing inside mount, on the raised surface the other header buttons use. No mount = a fixed
   button top right, out of the way of the sidebar navigator on the left.
   Theme: reads --card, --text, --shadow from the page (dark defaults if missing). */
(function () {
  'use strict';
  if (window.RoboHome) return;
  var STYLE = '' +
    '.rhome{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;background:var(--card,#24221c);color:var(--text,#e8e2d2);' +
      'font:600 14px Outfit,system-ui,sans-serif;text-decoration:none;white-space:nowrap;transition:transform .15s,box-shadow .15s;box-shadow:0 0 0 transparent}' +
    '.rhome:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--shadow,#000)}.rhome:active{transform:translate(1px,1px);box-shadow:0 0 0 transparent;transition-duration:.06s}' +
    '.rhome:focus-visible{outline:2px solid var(--accent,#ff6b1a);outline-offset:2px}' +
    '.rhome.fixed{position:fixed;top:14px;right:16px;z-index:9002}';
  window.RoboHome = {
    init: function (opts) {
      var cfg = Object.assign({ href: 'http://localhost:50000/', label: 'Home', title: 'the Agentic OS', mount: null }, opts || {});
      var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
      var a = document.createElement('a'); a.className = 'rhome'; a.href = cfg.href; a.title = 'Back to ' + cfg.title;
      a.innerHTML = '<span aria-hidden="true">←</span>' + cfg.label;
      var host = cfg.mount && document.querySelector(cfg.mount);
      if (host) host.insertBefore(a, host.firstChild); else { a.classList.add('fixed'); document.body.appendChild(a); }
      return a;
    }
  };
})();
