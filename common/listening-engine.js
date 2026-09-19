/* 英検リスニング マークシート＋音声プレイヤー 共通エンジン
   config = {
     storageKey: 'ek-p1-listening-2024_1',
     tracks: [{file, name}],              // tracks.json の1回分の listening セクション
     parts: [                             // Part（第◯部）の定義
       { prefix:'Part1', label:'Part1 会話の内容一致選択', note:'12問・4択' },
       ...
     ]
   }
   トラック名の末尾 "No13 14" のような表記から対応する問題番号を抽出し、
   1トラックが複数問をカバーする場合（準1級Part2など）にも対応する。
*/
(function (global) {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function parseNos(name) {
    var m = name.match(/No([\d\s]+)\s*$/);
    if (!m) return [];
    return m[1].trim().split(/\s+/).map(Number);
  }
  function matchPartIdx(name, parts) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].prefix;
      if (name === p || name.indexOf(p + ' ') === 0) return i;
    }
    return -1;
  }
  function loadState(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function saveState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
  }

  function render(container, audioEl, config) {
    container.innerHTML = '';
    var state = loadState(config.storageKey);
    state.answers = state.answers || {};
    state.correctRaw = state.correctRaw || {};

    var groups = config.parts.map(function (p) { return { def: p, intro: [], items: [] }; });
    var preIntro = [];

    config.tracks.forEach(function (t, idx) {
      var pi = matchPartIdx(t.name, config.parts);
      if (pi === -1) { preIntro.push({ t: t, idx: idx }); return; }
      var nos = parseNos(t.name);
      if (nos.length === 0) groups[pi].intro.push({ t: t, idx: idx });
      else groups[pi].items.push({ t: t, idx: idx, nos: nos });
    });

    var judgeEls = {}; // "q13" -> el

    function playBtn(label, file) {
      var b = el('button', 'btn secondary', '▶ ' + label);
      b.type = 'button';
      b.style.fontSize = '12px';
      b.style.padding = '6px 10px';
      b.addEventListener('click', function () {
        audioEl.src = file;
        audioEl.play();
      });
      return b;
    }

    if (preIntro.length) {
      var introCard = el('div', 'card');
      introCard.appendChild(el('h2', null, '指示・概要'));
      var row = el('div', 'qrow');
      preIntro.forEach(function (it) { row.appendChild(playBtn(it.t.name, it.t.file)); });
      introCard.appendChild(row);
      container.appendChild(introCard);
    }

    groups.forEach(function (g) {
      var card = el('div', 'card');
      card.appendChild(el('h2', null, g.def.label));
      if (g.def.note) card.appendChild(el('div', 'sec-note', g.def.note));

      if (g.intro.length) {
        var introRow = el('div', 'qrow');
        g.intro.forEach(function (it) { introRow.appendChild(playBtn('全体を再生', it.t.file)); });
        card.appendChild(introRow);
      }

      g.items.forEach(function (it) {
        var head = el('div', 'track-head');
        head.appendChild(playBtn('No' + it.nos.join(', ') + ' を再生', it.t.file));
        card.appendChild(head);

        it.nos.forEach(function (no) {
          var qkey = 'q' + no;
          var row = el('div', 'qrow');
          row.appendChild(el('div', 'qnum', String(no)));
          var choicesWrap = el('div', 'choices');
          for (var c = 1; c <= 4; c++) {
            (function (c) {
              var b = el('button', 'choice-btn', String(c));
              b.type = 'button';
              if (String(state.answers[qkey]) === String(c)) b.classList.add('selected');
              b.addEventListener('click', function () {
                state.answers[qkey] = c;
                Array.prototype.forEach.call(choicesWrap.children, function (btn) {
                  btn.classList.toggle('selected', btn.textContent === String(c));
                });
                saveState(config.storageKey, state);
              });
              choicesWrap.appendChild(b);
            })(c);
          }
          row.appendChild(choicesWrap);
          var judge = el('span', 'judge');
          row.appendChild(judge);
          judgeEls[qkey] = judge;
          card.appendChild(row);
        });
      });

      container.appendChild(card);
    });

    // 採点エリア
    var gradeBox = el('div', 'grade-box');
    var gradeCard = el('div', 'grade-card');

    config.parts.forEach(function (p) {
      var row = el('div', 'paste-answer-row');
      row.appendChild(el('label', null, p.label + ' の正答（問題番号順にカンマ区切り）'));
      var input = el('input');
      input.type = 'text';
      input.dataset.prefix = p.prefix;
      input.value = state.correctRaw[p.prefix] || '';
      row.appendChild(input);
      gradeCard.appendChild(row);
    });

    var btnRow = el('div', 'row');
    var gradeBtn = el('button', 'btn', '採点する');
    var resetBtn = el('button', 'btn secondary', '解答をリセット');
    btnRow.appendChild(gradeBtn);
    btnRow.appendChild(resetBtn);
    gradeCard.appendChild(btnRow);
    var summary = el('div', 'summary');
    gradeCard.appendChild(summary);
    gradeBox.appendChild(gradeCard);
    container.appendChild(gradeBox);

    function doGrade() {
      var totalQ = 0, totalOk = 0, breakdown = [];
      groups.forEach(function (g) {
        var input = gradeCard.querySelector('input[data-prefix="' + g.def.prefix + '"]');
        var raw = input.value.trim();
        state.correctRaw[g.def.prefix] = raw;
        var list = raw.split(/[,、\s]+/).filter(function (s) { return s !== ''; });

        var nos = [];
        g.items.forEach(function (it) { nos = nos.concat(it.nos); });
        nos.sort(function (a, b) { return a - b; });

        var secOk = 0, secTotal = 0;
        nos.forEach(function (no, i) {
          var qkey = 'q' + no;
          var jEl = judgeEls[qkey];
          var correct = list[i];
          if (!correct) { jEl.textContent = ''; jEl.className = 'judge'; return; }
          secTotal++; totalQ++;
          var ans = state.answers[qkey];
          if (ans != null && String(ans) === String(correct)) {
            secOk++; totalOk++;
            jEl.textContent = '○';
            jEl.className = 'judge ok';
          } else {
            jEl.innerHTML = '×<span class="ans-hint">正答' + correct + '</span>';
            jEl.className = 'judge ng';
          }
        });
        breakdown.push(g.def.label.replace(/^(Part\d+|第.部)\s*/, '$1') + ': <b>' + secOk + '/' + nos.length + '</b>');
      });

      saveState(config.storageKey, state);
      summary.classList.add('show');
      var pct = totalQ ? Math.round((totalOk / totalQ) * 1000) / 10 : 0;
      summary.innerHTML =
        '<div class="total">' + totalOk + ' / ' + totalQ + ' 問 正解　<span class="pct">(' + pct + '%)</span></div>' +
        '<div class="breakdown">' + breakdown.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>';
    }

    gradeBtn.addEventListener('click', doGrade);
    resetBtn.addEventListener('click', function () {
      if (!confirm('この回の解答・採点結果をすべてリセットします。よろしいですか？')) return;
      localStorage.removeItem(config.storageKey);
      render(container, audioEl, config);
    });

    var hasCorrect = Object.keys(state.correctRaw).some(function (k) { return state.correctRaw[k]; });
    if (hasCorrect) doGrade();
  }

  global.EikenListening = { render: render, parseNos: parseNos };
})(window);
