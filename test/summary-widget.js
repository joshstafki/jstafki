/* FINTECH summary widget (drop-in)
   Add this line just before </body> in index.html:
   <script src="summary-widget.js" defer></script>
   It builds its own card at the top of the middle column and reads the figures the dashboard already shows. */
(function () {
    'use strict';

    var CSS = `
    .summary-lines { list-style: none; }
    .summary-lines li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border-color); animation: summaryRowIn 0.35s ease both; }
    @keyframes summaryRowIn { from { opacity: 0; transform: translateY(6px); } }
    .summary-run-wrap { padding: 1rem 1.25rem; }
    .summary-run { width: 100%; min-height: 44px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--accent-soft); color: var(--accent-text); font-weight: 600; cursor: pointer; }
    .summary-run:disabled { opacity: 0.6; cursor: wait; }
    .summary-stale { padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 0.7rem; font-weight: 600; }
    .summary-busy { margin: auto; padding: 1.75rem 2rem; max-width: min(340px, calc(100vw - 2rem)); border: 1px solid var(--border-color); border-radius: 14px; background: var(--card-bg); color: var(--text-main); text-align: center; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35); }
    .summary-busy::backdrop { background: rgba(15, 23, 42, 0.4); }
    @media (prefers-reduced-motion: reduce) { .summary-lines li { animation: none; } }`;

    var HTML = `
    <div class="card" id="summary-card">
        <div class="card-header header-green card-header-row">
            Summary
            <span id="summary-stale" class="summary-stale" hidden>Out of date</span>
        </div>
        <div class="card-body">
            <ul id="summary-lines" class="summary-lines" aria-live="polite"></ul>
            <div class="summary-run-wrap">
                <button type="button" id="btn-run-summary" class="summary-run">Run summary</button>
            </div>
        </div>
        <dialog id="summary-busy" class="summary-busy" aria-label="Processing">
            <div class="spinner"></div>
            <p>Please wait while your summary is being processed.</p>
        </dialog>
    </div>`;

    var $ = function (id) { return document.getElementById(id); };
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    // Same format as the dashboard's own formatMoney.
    var money = function (n) { return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2); };
    var num = function (t) { var n = parseFloat(String(t).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };

    // [label, amount, isIncome]. Edit here if "Net" should mean something else.
    var collect = function () {
        return [
            ['Total Spendable Income', num($('spendable-income').value), true],
            ['Net Out of Pocket', num($('out-of-pocket-total').textContent), false],
            ['Net Bank Initiated', num($('bank-initiated-total').textContent), false],
            ['Net Gas', num($('est-gas').value), false],
            ['Net Groceries', num($('est-groceries').value), false]
        ];
    };
    var signature = function () { return JSON.stringify(collect().map(function (r) { return r[1]; })); };

    function init() {
        var host = $('spendable-income') && $('spendable-income').closest('.card');
        if (!host) return;

        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        var tmp = document.createElement('div');
        tmp.innerHTML = HTML.trim();
        host.parentElement.prepend(tmp.firstElementChild);

        var btn = $('btn-run-summary'), list = $('summary-lines'), busy = $('summary-busy'), stale = $('summary-stale');
        var sig = '', running = false;

        var checkStale = function () { if (sig) stale.hidden = (signature() === sig); };

        var makeRow = function (row) {
            var li = document.createElement('li');
            var name = document.createElement('span');
            name.textContent = row[0];
            var val = document.createElement('strong');
            val.className = row[2] ? 'amount-cell' : 'amount-cell amount-red';
            // The income row reuses the dashboard's mask classes, so the eye toggle hides it here too.
            if (row[2]) val.innerHTML = '<span class="income-derived">' + money(row[1]) + '</span><span class="derived-mask" role="img" aria-label="Amount hidden">$XXXX.XX</span>';
            else val.textContent = money(row[1]);
            li.append(name, val);
            return li;
        };

        var run = async function () {
            if (running) return;
            running = true;
            btn.disabled = true;
            stale.hidden = true;
            list.textContent = '';
            busy.showModal();
            await sleep(900); // the figures are already live on the page, so this pause is for feel
            var rows = collect();
            sig = signature();
            busy.close();
            var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            for (var i = 0; i < rows.length; i++) {
                list.append(makeRow(rows[i]));
                if (!still) await sleep(350);
            }
            btn.textContent = 'Run again';
            btn.disabled = false;
            running = false;
            checkStale();
        };

        btn.addEventListener('click', run);
        busy.addEventListener('cancel', function (e) { e.preventDefault(); });

        // Flag the summary as out of date when any of its figures change.
        document.addEventListener('input', checkStale);
        var mo = new MutationObserver(checkStale);
        ['out-of-pocket-total', 'bank-initiated-total'].forEach(function (id) {
            if ($(id)) mo.observe($(id), { childList: true, characterData: true, subtree: true });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
