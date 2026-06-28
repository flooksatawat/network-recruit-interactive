/* ============================================================
   Innove Life — interactive recruit web
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const num = (n) => new Intl.NumberFormat("th-TH").format(Math.round(n));
const baht = (n) => "฿" + num(n);

/* ---- ✏️ แก้ช่องทางติดต่อจริงของคุณตรงนี้ที่เดียว ---- */
const CONTACT = {
  line: "https://line.me/R/ti/p/@innovelife", // เปลี่ยนเป็น LINE ของคุณ
  tel: "0812345678", // เปลี่ยนเป็นเบอร์ของคุณ
};

/* ============================================================
   INCOME MODEL (ใช้ชุดเดียวกันทั้งเว็บ เพื่อความสอดคล้อง)
   ============================================================ */
const RATES = { personal: 0.25, l1: 0.08, l2: 0.05, l3: 0.03 };
const LEADERSHIP = [0, 0.01, 0.02, 0.03, 0.04]; // โบนัสบริหารตามชั้นยศ
const RANKS = [
  { name: "Starter", min: 0 },
  { name: "Builder", min: 20000 },
  { name: "Leader", min: 60000 },
  { name: "Director", min: 150000 },
  { name: "Innovator", min: 400000 },
];

function rankIndex(volume) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (volume >= r.min) idx = i;
  });
  return idx;
}

function model(direct, dup, ticket) {
  const l1 = direct;
  const l2 = direct * dup;
  const l3 = direct * dup * dup;
  const team = l1 + l2 + l3;
  const volume = team * ticket;
  const rank = rankIndex(volume);
  const incPersonal = ticket * RATES.personal;
  const inc1 = l1 * ticket * RATES.l1;
  const inc2 = l2 * ticket * RATES.l2;
  const inc3 = l3 * ticket * RATES.l3;
  const incLead = volume * LEADERSHIP[rank];
  const income = incPersonal + inc1 + inc2 + inc3 + incLead;
  return { l1, l2, l3, team, volume, rank, incPersonal, inc1, inc2, inc3, incLead, income };
}

/* ============================================================
   SVG node helpers
   ============================================================ */
function nodeMarkup({ x, y, r, label, cls = "" }) {
  return `<g class="node ${cls}" transform="translate(${x} ${y})">
      <circle r="${r}"></circle>
      <text>${label}</text>
    </g>`;
}
function linkMarkup(from, to, cls = "") {
  const my = (from.y + to.y) / 2;
  return `<path class="link ${cls}" d="M ${from.x} ${from.y + from.r} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y - to.r}"></path>`;
}

/* ============================================================
   HERO mini network — interactive "live" team structure
   แผนโครงสร้าง 1 สายงาน (single downline line, by depth)
   ============================================================ */
const HERO = {
  ticket: 1000,
  x: 120,
  // คุณ -> คน 1 -> คน 2 (แนะนำรับ 35% = 350 บาท ต่อตำแหน่ง)
  chain: [
    { label: "คุณ", role: "center", level: 0, y: 60,  r: 22, side: "฿1,000", pct: null, rate: 0 },
    { label: "1",   role: "l1",     level: 1, y: 148, r: 18, side: "รับ 350 บาท", pct: "(1,000 × 35%)", rate: 0.35 },
    { label: "2",   role: "l1",     level: 2, y: 226, r: 18, side: "รับ 350 บาท", pct: "(1,000 × 35%)", rate: 0.35 },
  ],
};

/* matrix model: no personal sale — only referral commissions 35% per position */
HERO.personal = 0;
HERO.comm = HERO.chain.map((n) => (n.level === 0 ? 0 : HERO.ticket * n.rate)); // [0,350,350]
HERO.cumIncome = HERO.chain.map((_, i) =>
  HERO.comm.slice(0, i + 1).reduce((s, v) => s + v, 0)
); // [0, 350, 700]
HERO.lineDepth = HERO.chain.length - 1; // 2
HERO.lineIncome = HERO.cumIncome[HERO.lineDepth]; // ฿700

/* Hero node markup: OUTER <g> carries the positioning transform, an INNER
   <g class="hfx"> carries the pop-in animation — keeping them separate stops
   the CSS scale() in @keyframes pop from clobbering the SVG translate().
   A side chip labels each level with its commission rate. */
function heroNode({ x, y, r, label = "", role, level, pop, side, pct, aria }) {
  const txt = label === "" ? "" : `<text>${label}</text>`;
  const chip = side
    ? (() => {
        if (pct) {
          return `<g class="hchip" transform="translate(100 0)">
            <rect x="-68" y="-22" width="136" height="44" rx="14"></rect>
            <text x="0" y="-6" class="hchip-line1">${side}</text>
            <text x="0" y="12" class="hchip-line2">${pct}</text>
          </g>`;
        }
        return `<g class="hchip" transform="translate(94 0)">
          <rect x="-60" y="-15" width="120" height="30" rx="15"></rect>
          <text x="0" y="1">${side}</text>
        </g>`;
      })()
    : "";
  return `<g class="hnode ${role}" data-level="${level}"
      transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${aria}">
      <g class="hfx ${pop}"><circle r="${r}"></circle>${txt}</g>${chip}
    </g>`;
}
function heroLink(from, to, level) {
  const my = (from.y + to.y) / 2;
  return `<path class="hlink" data-level="${level}"
      d="M ${from.x} ${from.y + from.r} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y - to.r}"></path>`;
}

function renderHeroNet() {
  const linksEl = $("#heroLinks");
  const nodesEl = $("#heroNodes");
  if (!linksEl) return;

  const nodes = HERO.chain.map((n) => ({ ...n, x: HERO.x }));

  const links = nodes
    .slice(1)
    .map((n, i) => heroLink(nodes[i], n, n.level))
    .join("");

  const markup = nodes
    .map((n, i) =>
      heroNode({
        ...n,
        pop: i === 0 ? "" : `pop d${i - 1}`,
        aria:
          n.level === 0
            ? "คุณ — ฐานของสายงาน กดเพื่อดูทั้งสาย"
            : `${n.side} แนะนำรับ ${n.pct}${n.level === HERO.lineDepth ? " — กดเพื่อเปิดเมทริกโบนัส" : ""}`,
      })
    )
    .join("");

  linksEl.innerHTML = links;
  nodesEl.innerHTML = markup;

  setHeroStat($("#heroTeam"), HERO.lineDepth, "");
  setHeroStat($("#heroIncome"), HERO.lineIncome, "฿");
}

/* ---- footer stat tween (gives the "LIVE" numbers a lively feel) ---- */
function setHeroStat(el, value, prefix) {
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const from = Number(el.dataset.val || 0);
  el.dataset.val = value;
  if (reduce || from === value) {
    el.textContent = prefix + num(value);
    return;
  }
  const dur = 520;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + num(from + (value - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ============================================================
   HERO interactivity — hover/focus lights the line down to a
   level; click pins it and drills the footer into that depth.
   ============================================================ */
function initHeroInteractions() {
  const svg = $("#heroNet");
  const card = svg && svg.closest(".hero-card");
  if (!svg || !card) return;

  const tip = $("#heroTip");
  const teamLabel = $("#heroTeamLabel");
  const incomeLabel = $("#heroIncomeLabel");
  let pinned = null; // depth level that is locked in, or null

  const setActiveDepth = (depth) => {
    // depth === null -> neutral resting state (no highlight/dim)
    // depth === 0    -> "คุณ" selected = light up the whole line
    // depth >= 1     -> light up คุณ..ชั้น{depth}, dim the rest
    const neutral = depth === null;
    const whole = depth === 0;
    const onIf = (lv) => whole || lv <= depth;
    $$(".hnode", svg).forEach((n) => {
      if (neutral) return n.classList.remove("is-on", "is-dim");
      const on = onIf(Number(n.dataset.level));
      n.classList.toggle("is-on", on);
      n.classList.toggle("is-dim", !on);
    });
    $$(".hlink", svg).forEach((l) => {
      if (neutral) return l.classList.remove("is-on", "is-dim");
      const on = onIf(Number(l.dataset.level));
      l.classList.toggle("is-on", on);
      l.classList.toggle("is-dim", !on);
    });
  };

  const showTip = (node) => {
    if (!tip) return;
    const lv = Number(node.dataset.level);
    let title, sub;
    if (lv === 0) {
      title = "คุณ";
      sub = `ฐานของสายงาน · แนะนำรับ 35% ต่อตำแหน่ง`;
    } else {
      title = `คน ${lv} · แนะนำ ${HERO.chain[lv].pct}`;
      sub = `+${baht(HERO.comm[lv])}/เดือน · สะสม ${baht(HERO.cumIncome[lv])}`;
    }
    tip.innerHTML = `<b>${title}</b><span>${sub}</span>`;
    const cb = card.getBoundingClientRect();
    const nb = node.querySelector("circle").getBoundingClientRect();
    tip.style.left = `${nb.left + nb.width / 2 - cb.left}px`;
    tip.style.top = `${nb.top - cb.top}px`;
    tip.classList.add("show");
  };
  const hideTip = () => tip && tip.classList.remove("show");

  const drillFooter = (depth) => {
    if (depth === null || depth === 0) {
      teamLabel.textContent = "สมาชิกในสายนี้";
      incomeLabel.textContent = "รายได้จากสายนี้/เดือน";
      setHeroStat($("#heroTeam"), HERO.lineDepth, "");
      setHeroStat($("#heroIncome"), HERO.lineIncome, "฿");
    } else {
      teamLabel.textContent = `สมาชิกถึงชั้น ${depth}`;
      incomeLabel.textContent = "รายได้สะสม/เดือน";
      setHeroStat($("#heroTeam"), depth, "");
      setHeroStat($("#heroIncome"), HERO.cumIncome[depth], "฿");
    }
  };

  const preview = (node) => {
    setActiveDepth(Number(node.dataset.level));
    showTip(node);
  };
  const clearPreview = () => {
    setActiveDepth(pinned);
    hideTip();
  };

  const select = (node) => {
    const depth = Number(node.dataset.level);
    pinned = pinned === depth ? null : depth;
    setActiveDepth(pinned);
    drillFooter(pinned);
    if (depth === HERO.lineDepth) showMatrixBonus();
  };

  $$(".hnode", svg).forEach((node) => {
    node.addEventListener("mouseenter", () => preview(node));
    node.addEventListener("mouseleave", clearPreview);
    node.addEventListener("focus", () => preview(node));
    node.addEventListener("blur", clearPreview);
    node.addEventListener("click", () => select(node));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(node);
      }
    });
  });

  // click empty card area to reset the pinned selection
  card.addEventListener("click", (e) => {
    if (e.target.closest(".hnode")) return;
    pinned = null;
    setActiveDepth(null);
    drillFooter(null);
  });

  setActiveDepth(null);
}

/* ============================================================
   MAIN network whiteboard + stepper
   ============================================================ */
const NET = {
  center: { x: 460, y: 86, r: 42, label: "คุณ", level: 0, cls: "center" },
  l1: [140, 360, 560, 780].map((x, i) => ({ x, y: 258, r: 30, label: i + 1, level: 1 })),
};
NET.l2 = [];
NET.l1.forEach((p, i) => {
  NET.l2.push({ x: p.x - 58, y: 430, r: 19, label: "", level: 2, parent: i });
  NET.l2.push({ x: p.x + 58, y: 430, r: 19, label: "", level: 2, parent: i });
});

let currentStep = 0;
const totalSteps = 5;

function renderNetwork() {
  const nodeLayer = $("#nodeLayer");
  const linkLayer = $("#linkLayer");
  if (!nodeLayer) return;

  // step -> highest visible/active level
  const activeMax = currentStep === 0 ? 0 : currentStep === 1 ? 1 : 2;
  const showPct = currentStep >= 3;

  const allNodes = [NET.center, ...NET.l1, ...NET.l2];

  // links
  const links =
    NET.l1
      .map((n) => linkMarkup(NET.center, n, n.level <= activeMax ? "is-focus" : ""))
      .join("") +
    NET.l2
      .map((n) => linkMarkup(NET.l1[n.parent], n, n.level <= activeMax ? "is-focus" : ""))
      .join("");
  linkLayer.innerHTML = links;

  // nodes
  nodeLayer.innerHTML = allNodes
    .map((n) => {
      const state = n.level <= activeMax ? "is-focus" : "is-dim";
      return nodeMarkup({ ...n, cls: `${n.cls || ""} ${state}` });
    })
    .join("");

  // level labels (left side)
  const labels = [
    { y: 86,  t: "คุณ" },
    { y: 258, t: "คน 1 · 35%" },
    { y: 430, t: "คน 2 · 35%" },
  ];
  nodeLayer.innerHTML += labels
    .map((l) => `<text class="level-label" x="40" y="${l.y}">${l.t}</text>`)
    .join("");

  // percent pills near nodes (appear from step 4)
  if (showPct) {
    const pills = [
      { x: NET.center.x + 52, y: 70, t: "25%" },
      { x: NET.l1[3].x + 40, y: 250, t: "8%" },
      { x: NET.l2[NET.l2.length - 1].x + 26, y: 426, t: "5%" },
    ];
    nodeLayer.innerHTML += pills
      .map(
        (p) => `<g class="pct-pill" transform="translate(${p.x} ${p.y})">
          <rect x="-22" y="-13" width="44" height="26" rx="13" fill="url(#nodeGradGold)"></rect>
          <text x="0" y="1" text-anchor="middle" dominant-baseline="middle">${p.t}</text>
        </g>`
      )
      .join("");
  }
}

function setStep(step) {
  currentStep = (step + totalSteps) % totalSteps;
  $("#stepText").textContent = `${currentStep + 1} / ${totalSteps}`;
  $("#stepBar").style.width = `${((currentStep + 1) / totalSteps) * 100}%`;
  $$(".detail-card").forEach((card, i) => card.classList.toggle("is-active", i === currentStep));
  renderNetwork();
}

/* ============================================================
   SIMULATOR
   ============================================================ */
const directInput = $("#directInput");
const dupInput = $("#dupInput");
const ticketInput = $("#ticketInput");

function renderBars(rows) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  $("#barChart").innerHTML = rows
    .map((r) => {
      const w = Math.max(4, (r.value / max) * 100);
      return `<div class="bar-row">
        <span class="bl">${r.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <span class="bv">${baht(r.value)}</span>
      </div>`;
    })
    .join("");
}

function calculate() {
  const direct = Number(directInput.value);
  const dup = Number(dupInput.value);
  const ticket = Number(ticketInput.value);
  const m = model(direct, dup, ticket);

  $("#directOut").value = direct;
  $("#dupOut").value = dup;
  $("#ticketOut").value = num(ticket);

  $("#teamTotal").textContent = num(m.team);
  $("#volumeTotal").textContent = num(m.volume);
  $("#incomeTotal").textContent = num(m.income);

  const rankName = RANKS[m.rank].name;
  $("#rankBadge").textContent = rankName;

  $("#scenarioLabel").textContent =
    m.team < 15 ? "เริ่มต้น" : m.team < 60 ? "กำลังขยายทีม" : "ทีมเติบโตเร็ว";

  // highlight target rank card
  $$(".rank").forEach((el) =>
    el.classList.toggle("is-target", Number(el.dataset.rank) === m.rank)
  );

  renderBars([
    { label: "ขายปลีก (คุณ)", value: m.incPersonal },
    { label: "ชั้น 1 · 8%", value: m.inc1 },
    { label: "ชั้น 2 · 5%", value: m.inc2 },
    { label: "ชั้น 3 · 3%", value: m.inc3 },
    { label: "โบนัสบริหาร", value: m.incLead },
  ]);
}

/* ============================================================
   NAV: scroll state + mobile menu
   ============================================================ */
function initNav() {
  const nav = $("#nav");
  const toggle = $("#navToggle");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

/* ============================================================
   Reveal on scroll + count-up
   ============================================================ */
function animateCount(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const dur = 1100;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initReveal() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    $$(".reveal").forEach((el) => el.classList.add("in"));
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || "")));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        $$("[data-count]", entry.target).forEach(animateCount);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.16 }
  );
  $$(".reveal").forEach((el) => io.observe(el));
}

/* ============================================================
   Contact: wire links + lead form
   ============================================================ */
function initContact() {
  $$('a[href^="https://line.me/"]').forEach((a) => (a.href = CONTACT.line));
  const callBtn = $("#callBtn");
  if (callBtn) callBtn.href = "tel:" + CONTACT.tel;

  const form = $("#leadForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#fName").value.trim();
    const contact = $("#fContact").value.trim();
    const status = $("#formStatus");
    if (!name || !contact) {
      status.style.color = "#fca5a5";
      status.textContent = "กรุณากรอกชื่อและช่องทางติดต่อ 🙏";
      return;
    }
    status.style.color = "";
    status.textContent = `ขอบคุณคุณ ${name}! ทีมงาน Innove Life จะติดต่อกลับโดยเร็วที่สุด 🌿`;
    form.reset();
  });
}

/* ============================================================
   MATRIX BONUS — show when node level-3 is clicked
   ============================================================ */
function initMatrixBonus() {
  const card = $("#matrixCard");
  const lockOverlay = $("#matrixLock");
  if (!card) return;

  // hide lock overlay immediately (card is hidden via CSS, no need for overlay)
  if (lockOverlay) lockOverlay.classList.add("hidden");
}

function showMatrixBonus() {
  if (document.getElementById("matrixPopup")) return; // already open

  const popup = document.createElement("div");
  popup.id = "matrixPopup";
  popup.className = "matrix-popup-overlay";
  popup.innerHTML = `
    <div class="matrix-popup" role="dialog" aria-modal="true">
      <button class="matrix-popup-close" aria-label="ปิด">✕</button>
      <div class="matrix-popup-lock">🔓</div>
      <h3 class="matrix-popup-title">ปลดล็อคแล้ว!</h3>
      <p class="matrix-popup-sub">แนะนำครบ 2 คน</p>
      <div class="matrix-popup-bonus">
        <span class="matrix-popup-label">รับโบนัส</span>
        <span class="matrix-popup-amount">฿500</span>
      </div>
    </div>`;
  document.body.appendChild(popup);

  // close handlers
  popup.querySelector(".matrix-popup-close").addEventListener("click", () => popup.remove());
  popup.addEventListener("click", (e) => { if (e.target === popup) popup.remove(); });

  // trigger entrance animation
  requestAnimationFrame(() => popup.classList.add("is-in"));
}

/* ============================================================
   INIT
   ============================================================ */
$("#yr").textContent = new Date().getFullYear();
renderHeroNet();
initHeroInteractions();
initMatrixBonus();
setStep(0);
calculate();

[directInput, dupInput, ticketInput].forEach((input) =>
  input.addEventListener("input", calculate)
);
$("#prevStep").addEventListener("click", () => setStep(currentStep - 1));
$("#nextStep").addEventListener("click", () => setStep(currentStep + 1));

initNav();
initReveal();
initContact();
