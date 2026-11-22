/* A small markdown renderer for teleprompter scripts, so the pages work offline with no outside libraries.
   It handles what scripts use: # headings, paragraphs, **bold**, *italic*, `code`, > quotes, - and 1. lists,
   --- dividers and ``` code blocks. All text is escaped first, so a script can never inject HTML into the page.
   Single line breaks inside a paragraph are kept, because a script writer usually means them. */
(function () {
  'use strict';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    s = esc(s);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');                        // links and images: keep the words only
    s = s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (m, a, b) => '<strong>' + (a || b) + '</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
    return s;
  }
  const isHr = l => /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
  const isUl = l => /^\s*[-*+]\s+/.test(l);
  const isOl = l => /^\s*\d+[.)]\s+/.test(l);
  const isHead = l => /^\s{0,3}#{1,6}\s+/.test(l);
  const isQuote = l => /^\s{0,3}>/.test(l);
  const isFence = l => /^\s{0,3}```/.test(l);

  function render(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (isFence(l)) {
        const body = []; i++;
        while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
        i++;
        out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }
      if (isHead(l)) {
        const m = l.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
        const n = m[1].length;
        out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>');
        i++; continue;
      }
      if (isHr(l)) { out.push('<hr>'); i++; continue; }
      if (isQuote(l)) {
        const body = [];
        while (i < lines.length && lines[i].trim() && isQuote(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
        out.push('<blockquote>' + render(body.join('\n')) + '</blockquote>');
        continue;
      }
      if (isUl(l) || isOl(l)) {
        const ordered = isOl(l), items = [];
        while (i < lines.length && lines[i].trim() && (ordered ? isOl(lines[i]) : isUl(lines[i]))) {
          let item = lines[i++].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, '');
          // a following indented line belongs to the same item
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !isUl(lines[i]) && !isOl(lines[i])) item += '\n' + lines[i++].trim();
          items.push('<li>' + item.split('\n').map(inline).join('<br>') + '</li>');
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !isHead(lines[i]) && !isHr(lines[i]) && !isFence(lines[i]) &&
             !(para.length && (isUl(lines[i]) || isOl(lines[i]) || isQuote(lines[i])))) para.push(lines[i++].trim());
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }
  window.renderMarkdown = render;
})();
