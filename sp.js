/* ShellProven — quiz, grade and progress (shared by lesson pages, lesson lists and /quiz/).
   Everything stays in this browser: results are kept in localStorage under "shellproven:v1".
   Nothing is sent anywhere, there are no accounts. */
(function () {
  var KEY = 'shellproven:v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // `code` in question text -> <code>
  function rich(node, s) {
    String(s).split(/(`[^`]*`)/).forEach(function (p) {
      if (/^`[^`]*`$/.test(p)) node.appendChild(el('code', null, p.slice(1, -1))); else if (p) node.appendChild(document.createTextNode(p));
    });
    return node;
  }
  var norm = function (s) { return String(s).trim().replace(/^\$\s*/, '').replace(/[“”"]/g, "'").replace(/\s+/g, ' ').replace(/\s*;\s*$/, ''); };

  // Grade scale (Sew 25.11): 10 questions -> 0–5 / 6–7 / 8–9 / 10; other counts by percent: <60 / 60–<80 / 80–<100 / 100
  function grade(score, total) {
    var p = total ? Math.round(score * 100 / total) : 0;
    if (total && score === total) return { key: 'advanced', label: 'Advanced', pct: p,
      text: 'You already have advanced knowledge of this topic. (Or you watched very, very carefully.)' };
    if (p >= 80) return { key: 'verygood', label: 'Very good', pct: p, text: 'Very good. Just a detail or two to polish — see below.' };
    if (p >= 60) return { key: 'good', label: 'Good', pct: p, text: 'Good — the basics are there. Have another look at the parts below.' };
    return { key: 'again', label: 'Needs another pass', pct: p,
      text: 'You should go through the lesson again, more carefully. Rewatch the parts below, then try again — it sticks the second time.' };
  }
  function fmtT(t) { return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  // Record a finished attempt. id = lesson slug or "_quiz"
  function record(id, score, total) {
    var d = load(); d.r = d.r || {};
    var g = grade(score, total), now = new Date().toISOString().slice(0, 10);
    var cur = { s: score, n: total, g: g.key, at: now }, r = d.r[id] || {};
    r.last = cur; r.tries = (r.tries || 0) + 1;
    if (!r.best || score / total > r.best.s / r.best.n || (score / total === r.best.s / r.best.n && total > r.best.n)) r.best = cur;
    d.r[id] = r; save(d); return r;
  }
  function result(id) { var d = load(); return (d.r || {})[id] || null; }
  function badge(r) { var g = grade(r.s, r.n); return g.label + ' · ' + r.s + '/' + r.n; }

  /* Quiz engine.
     opts: { root, questions, id, title, review: function(q) -> [{href, text, onclick?}], retry: function() (new attempt; default re-render) } */
  function quiz(o) {
    var root = o.root, qs = o.questions, first = {}, answered = 0;
    root.innerHTML = '';
    var prev = result(o.id);
    if (prev && prev.best) root.appendChild(el('p', 'sub', 'Your best so far: ' + badge(prev.best) + ' · last: ' + badge(prev.last) + '. Saved only in this browser.'));
    var head = el('p', 'quiz-count', '0 of ' + qs.length + ' answered'); root.appendChild(head);
    var out = el('div', 'grade'); out.hidden = true;
    function firstAnswer(i, ok) {
      if (i in first) return;
      first[i] = ok; answered++;
      head.textContent = answered + ' of ' + qs.length + ' answered' + (answered < qs.length ? ' — your first answer to each question counts.' : '');
      if (answered === qs.length) finish();
    }
    function finish() {
      var score = 0, wrong = [];
      qs.forEach(function (q, i) { if (first[i]) score++; else wrong.push(i); });
      var g = grade(score, qs.length), r = record(o.id, score, qs.length);
      out.innerHTML = ''; out.hidden = false; out.className = 'grade g-' + g.key;
      out.appendChild(el('div', 'g-label', g.label));
      out.appendChild(el('div', 'g-score', score + '/' + qs.length + ' · ' + g.pct + '%'));
      out.appendChild(el('p', 'g-text', g.text));
      if (wrong.length) {
        out.appendChild(el('p', 'g-sub', 'Worth another look:'));
        var ul = el('ul', 'g-review');
        wrong.forEach(function (i) {
          var li = el('li'); rich(li, (i + 1) + '. ' + qs[i].q);
          (o.review ? o.review(qs[i]) : []).forEach(function (l) {
            var a = el('a', null, l.text); a.href = l.href; if (l.onclick) a.addEventListener('click', l.onclick);
            li.appendChild(document.createTextNode(' ')); li.appendChild(a);
          });
          ul.appendChild(li);
        });
        out.appendChild(ul);
      }
      out.appendChild(el('p', 'g-sub', 'Best: ' + badge(r.best) + ' · attempts: ' + r.tries + '. Saved only in this browser.'));
      var b = el('button', 'btn primary', 'Try again'); b.type = 'button';
      b.addEventListener('click', function () { (o.retry || function () { quiz(o); })(); root.scrollIntoView({ behavior: 'smooth' }); });
      out.appendChild(b);
      if (o.onFinish) o.onFinish(score, qs.length);
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    qs.forEach(function (q, i) {
      var box = el('div', 'q');
      if (q.from) { var k = el('p', 'quiz-count'); var fa = el('a', null, q.from); fa.href = q.fromHref; k.appendChild(fa); box.appendChild(k); }
      box.appendChild(rich(el('h3'), (i + 1) + '. ' + q.q));
      if (q.show) { var pre = el('pre'); pre.appendChild(el('code', null, '$ ' + q.show)); box.appendChild(pre); }
      var fb = el('p', 'fb'), ex = rich(el('p', 'expl'), q.expl || ''); ex.hidden = true;
      var mark = function (ok, again) {
        firstAnswer(i, ok);
        fb.textContent = ok ? (first[i] ? 'Correct.' : 'Correct now — but your first answer counts for the grade.') : again;
        fb.className = 'fb ' + (ok ? 'ok' : 'bad'); if (ok) ex.hidden = false;
      };
      if (q.type === 'choice') {
        var opts = el('div', 'opts');
        q.opts.forEach(function (t, j) {
          var l = el('label'), r = document.createElement('input'); r.type = 'radio'; r.name = (o.id || 'q') + '-' + i; r.value = j;
          r.addEventListener('change', function () { mark(j === q.a, 'Not quite — try again.'); });
          l.appendChild(r);
          var span = el('span');
          if (q.kind === 'output') { span.className = 'out'; span.textContent = t.replace(/\\n/g, '\n'); } else rich(span, t);
          l.appendChild(span); opts.appendChild(l);
        });
        box.appendChild(opts);
      } else {
        var row = el('div', 'row'), inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = 'type the command…'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', 'off');
        inp.setAttribute('aria-label', 'Your command for question ' + (i + 1));
        var b = el('button', 'btn', 'Check'); b.type = 'button';
        var show = el('button', 'btn', 'Show answer'); show.type = 'button';
        var check = function () {
          if (!inp.value.trim()) return;
          var v = norm(inp.value), ok = (q.answers || []).some(function (a) { return norm(a) === v; });
          mark(ok, 'Not quite — compare with the lesson and try again.');
        };
        show.addEventListener('click', function () {
          firstAnswer(i, false); inp.value = q.answers[0];
          fb.textContent = 'One correct answer: ' + q.answers[0] + (q.answers.length > 1 ? '  (also accepted: ' + q.answers.slice(1).join('  |  ') + ')' : '');
          fb.className = 'fb'; ex.hidden = false;
        });
        b.addEventListener('click', check); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
        box.appendChild(inp); row.appendChild(b); row.appendChild(show); box.appendChild(row);
      }
      box.appendChild(fb); box.appendChild(ex); root.appendChild(box);
    });
    root.appendChild(out);
  }

  // Lesson lists (home page, lekcje/): progress bar + "Best: …" on each lesson card. base = path to site root.
  function progress(base) {
    var bar = document.getElementById('progress');
    fetch(base + 'lekcje/lekcje.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
      var L = j.lekcje || [], done = 0;
      L.forEach(function (l) {
        var r = result(l.slug); if (r && r.last) done++;
        var a = document.querySelector('a.lesson[href$="' + l.slug + '/"]');
        if (a && r && r.best) {
          var box = a.querySelector('div') || a;
          var t = el('span', 'tag best g-' + r.best.g, 'Best: ' + badge(r.best)); box.appendChild(t);
        }
      });
      if (!bar) return;
      bar.hidden = false;
      bar.querySelector('.p-text').textContent = 'Completed ' + done + ' of ' + L.length + ' lesson quizzes';
      bar.querySelector('.p-fill').style.width = (L.length ? Math.round(done * 100 / L.length) : 0) + '%';
      var qz = result('_quiz'); if (qz && qz.best) bar.querySelector('.p-quiz').textContent = 'Test yourself — best: ' + badge(qz.best);
    }).catch(function () {});
  }

  window.SP = { quiz: quiz, grade: grade, progress: progress, result: result, badge: badge, fmtT: fmtT, rich: rich, el: el };
})();
