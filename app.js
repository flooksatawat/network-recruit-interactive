/* ============================================================
   Innova Life — interactive recruit web
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const num = (n) => {
  const value = Math.round(Number(n) || 0);
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    const compact = Number.isInteger(millions)
      ? String(millions)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, useGrouping: false }).format(millions);
    return `${compact} ล้าน`;
  }
  return new Intl.NumberFormat("th-TH").format(value);
};
const baht = (n) => "฿" + num(n);

/* ---- ✏️ แก้ช่องทางติดต่อจริงของคุณตรงนี้ที่เดียว ---- */
const CONTACT = {
  line: "https://line.me/R/ti/p/@innovelife", // เปลี่ยนเป็น LINE ของคุณ
  tel: "0812345678", // เปลี่ยนเป็นเบอร์ของคุณ
};

/* ============================================================
   INCOME MODEL (ใช้ชุดเดียวกันทั้งเว็บ เพื่อความสอดคล้อง)
   ============================================================ */
const G1_RATE = 350;  // บาท/คน สำหรับชั้น G1
const G_RATE  = 10;   // บาท/คน สำหรับชั้น G2-G8
const MAX_GEN = 8;

// คำนวณรายได้แบบทบกำลัง G1-G8
function model(direct, dup) {
  const gens = [];
  for (let g = 1; g <= MAX_GEN; g++) {
    const count = g === 1 ? direct : direct * Math.pow(dup, g - 1);
    const rate  = g === 1 ? G1_RATE : G_RATE;
    const inc   = count * rate;
    gens.push({ g, count, rate, inc });
  }
  const team   = gens.reduce((s, g) => s + g.count, 0);
  const income = gens.reduce((s, g) => s + g.inc, 0);
  return { gens, team, income };
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
/* สร้าง chain 11 node (คุณ + 10 คน) แถวเดียวแนวนอน */
const HERO = { ticket: 1000, chain: [] };
(function () {
  const X_STEP = 74, X0 = 50, Y0 = 70;
  for (let i = 0; i <= 10; i++) {
    HERO.chain.push({
      label: i === 0 ? "คุณ" : String(i),
      role:  i === 0 ? "center" : "l1",
      level: i,
      x: X0 + i * X_STEP,
      y: Y0,
      r: 22,
      side: i === 0 ? "ซื้อสินค้า" : "รับ 350 บาท",
      pct:  i === 0 ? "฿1,000" : "(350/คน)",
      comm: i === 0 ? 0 : 350,
    });
  }
})();

/* branch state — row 2 ที่แตกจาก person 1 */
let branchActive = false;
let branchCollapsed = false;
const BRANCH_Y = 215;

/* fixed-baht commissions per person */
HERO.personal = 0;
HERO.comm = HERO.chain.map((n) => n.comm); // [0, 350, 350, ...]
HERO.cumIncome = HERO.chain.map((_, i) =>
  HERO.comm.slice(0, i + 1).reduce((s, v) => s + v, 0)
); // [0, 350, 700, ...]
HERO.lineDepth = HERO.chain.length - 1; // 2
HERO.lineIncome = HERO.cumIncome[HERO.lineDepth]; // ฿360

/* Hero node markup: OUTER <g> carries the positioning transform, an INNER
   <g class="hfx"> carries the pop-in animation — keeping them separate stops
   the CSS scale() in @keyframes pop from clobbering the SVG translate().
   A side chip labels each level with its commission rate. */
function heroNode({ x, y, r, label = "", role, level, pop, side, pct, aria, comm = 0 }) {
  // person icon — same size for all, no circle background
  const txt = `<circle class="hicon-head" cx="0" cy="-11" r="9"/>
    <path class="hicon-body" d="M -13 8 C -13 -3 13 -3 13 8"/>`;
  const pulseRingEl = level === 0
    ? `<circle class="hnode-pulse-ring" r="22" fill="none" stroke="rgba(251,191,36,0.6)" stroke-width="2"/>`
    : "";
  const countLabel = level > 0
    ? `<text class="hnode-count" x="0" y="22" visibility="hidden">${level}</text>`
    : "";
  const chip = side
    ? (() => {
        if (level === 0) {
          return ""; // ไม่แสดง chip ที่วง คุณ
        }
        // income nodes — compact single label using actual comm value
        return `<g class="hchip" transform="translate(0 -34)">
          <rect x="-22" y="-12" width="44" height="24" rx="12"></rect>
          <text x="0" y="5" class="hchip-line1">+${comm}</text>
        </g>`;
      })()
    : "";
  return `<g class="hnode ${role}" data-level="${level}"
      transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${aria}">
      ${pulseRingEl}<g class="hfx ${pop}">${txt}</g>${chip}${countLabel}
    </g>`;
}
/* link with stroke-dashoffset draw animation; handles row-wrap transitions */
function heroLinkH(from, to, level) {
  if (from.y === to.y) {
    // same row → straight horizontal line
    const x1 = from.x + from.r;
    const x2 = to.x - to.r;
    const len = Math.round(x2 - x1);
    return `<path class="hlink" data-level="${level}" data-len="${len}"
        d="M ${x1} ${from.y} L ${x2} ${to.y}"
        stroke-dasharray="${len}" stroke-dashoffset="${len}"></path>`;
  } else {
    // row transition → semicircle on the right edge, then straight to next row start
    const x1 = from.x + from.r;
    const y1 = from.y;
    const x2 = to.x - to.r;
    const y2 = to.y;
    const ry = (y2 - y1) / 2;  // half row height
    const rx = Math.max(ry, 22);
    // arc right → down, then straight left
    const d = `M ${x1} ${y1} A ${rx} ${ry} 0 0 1 ${x1} ${y2} L ${x2} ${y2}`;
    const arcLen  = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const lineLen = x1 - x2;
    const len = Math.round(arcLen + lineLen);
    return `<path class="hlink hlink-wrap" data-level="${level}" data-len="${len}"
        d="${d}"
        stroke-dasharray="${len}" stroke-dashoffset="${len}"></path>`;
  }
}

/* ---- Hero step-by-step animation ----
   กดทีละครั้ง = +1 เส้น +1 วง +1 ชิบรายได้
   กดซ้ำหลังจบ = reset แล้วเริ่มใหม่                     */
const LINE_DURATION = 420; // ms วาดเส้น

let heroStep = 0;          // step ปัจจุบัน (0 = แสดงแค่ "คุณ")
let heroAnimBusy = false;  // ล็อกไม่ให้กดซ้อน

function resetHeroAnim() {
  heroStep = 0;
  heroAnimBusy = false;

  $$("#heroNodes .hnode").forEach((n) => n.classList.remove("is-revealed"));
  $$("#heroNodes .hnode .hfx").forEach((fx) => {
    fx.classList.remove("pop-now");
    void fx.offsetWidth;
  });
  $$("#heroLinks .hlink").forEach((link) => {
    link.style.transition = "none";
    link.style.strokeDashoffset = link.dataset.len || "100";
  });
  $$("#heroNodes .hchip").forEach((c) => c.classList.remove("chip-show"));
  $$("#heroNodes .hnode-count").forEach((c) => c.setAttribute("visibility", "hidden"));

  // ล้าง branch rows G2-G8
  branchActive = false;
  branchCollapsed = false;
  g3Active = false;
  r2Node1Clicks = 0;
  Object.keys(branchRowStates).forEach((key) => delete branchRowStates[key]);
  $$("#heroNodes .hnode[data-level^='r']").forEach((el) => el.remove());
  $$("#heroNodes .hero-row-summary").forEach((el) => el.remove());
  $$("#heroLinks .hlink[data-level^='r']").forEach((el) => el.remove());
  const svg = $("#heroNet");
  if (svg) svg.viewBox.baseVal.height = 140;
  setHeroStat($("#heroTeam"),   0, "");
  setHeroStat($("#heroIncome"), 0, "฿");
  updateCompanySales(0);

  // แสดงเฉพาะ node 0 ("คุณ") พร้อม chip
  const firstNode = document.querySelector("#heroNodes .hnode");
  const firstFx   = firstNode?.querySelector(".hfx");
  if (firstFx) { firstFx.classList.remove("pop-now"); void firstFx.offsetWidth; firstFx.classList.add("pop-now"); }
  if (firstNode) firstNode.classList.add("is-revealed");

  // reset ปุ่ม
  const wa = $("#withdrawAmount");
  if (wa) wa.textContent = "฿0";
  const btn = $("#heroReplayBtn");
  const lbl = btn && btn.querySelector(".hrb-label");
  if (lbl) lbl.textContent = "ถัดไป →";
}

/* สร้าง node ใหม่แบบ dynamic เมื่อ chain หมด */
function heroNextNode() {
  const chain  = HERO.chain;
  const prev   = chain[chain.length - 1];
  const STEP_X = 67;
  const level  = chain.length;
  const node   = {
    label: String(level),
    role:  "l1",
    level,
    x:     prev.x + STEP_X,
    y:     prev.y,
    r:     15,
    side:  "รับ 350 บาท",
    pct:   "(350/คน)",
    comm:  350,
  };
  chain.push(node);
  HERO.comm.push(350);
  HERO.cumIncome.push((HERO.cumIncome[HERO.cumIncome.length - 1] || 0) + 350);
  HERO.lineDepth  = chain.length - 1;
  HERO.lineIncome = HERO.cumIncome[HERO.lineDepth];

  const svg = $("#heroNet");
  if (svg) {
    // ขยาย viewBox
    const vb = svg.viewBox.baseVal;
    vb.width = node.x + node.r + 20;

    // append link
    const linksEl = $("#heroLinks");
    if (linksEl) {
      const tmp = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const x1  = prev.x + prev.r;
      const x2  = node.x - node.r;
      const len = Math.round(x2 - x1);
      tmp.setAttribute("class", "hlink");
      tmp.setAttribute("data-level", level);
      tmp.setAttribute("data-len", len);
      tmp.setAttribute("d", `M ${x1} ${prev.y} L ${x2} ${node.y}`);
      tmp.setAttribute("stroke-dasharray", len);
      tmp.setAttribute("stroke-dashoffset", len);
      linksEl.appendChild(tmp);
    }

    // append node
    const nodesEl = $("#heroNodes");
    if (nodesEl) {
      const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wrap.setAttribute("class", `hnode ${node.role}`);
      wrap.setAttribute("data-level", level);
      wrap.setAttribute("transform", `translate(${node.x} ${node.y})`);
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "button");
      wrap.innerHTML = `
        <g class="hfx">
          <circle class="hicon-head" cx="0" cy="-11" r="9"></circle>
          <path class="hicon-body" d="M -13 8 C -13 -3 13 -3 13 8"></path>
        </g>
        <g class="hchip" transform="translate(0 -34)">
          <rect x="-22" y="-12" width="44" height="24" rx="12"></rect>
          <text x="0" y="5" class="hchip-line1">+350</text>
        </g>
        <text class="hnode-count" x="0" y="22" visibility="hidden">${level}</text>`;
      nodesEl.appendChild(wrap);
    }
  }
  return node;
}

function advanceHeroStep() {
  if (heroAnimBusy) return;

  heroAnimBusy = true;
  heroStep += 1;

  // สร้าง node ใหม่ถ้า chain ยังไม่มี
  if (heroStep >= HERO.chain.length) heroNextNode();

  const i        = heroStep;
  const allFx    = $$("#heroNodes .hnode .hfx");
  const allNodes = $$("#heroNodes .hnode");
  const allLinks = $$("#heroLinks .hlink");
  const btn      = $("#heroReplayBtn");

  // 1) วาดเส้น
  const link = allLinks[i - 1];
  if (link) {
    link.style.transition = `stroke-dashoffset ${LINE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
    link.style.strokeDashoffset = "0";
  }

  // 2) pop node + chip + stat
  setTimeout(() => {
    const fx = allFx[i];
    if (fx) {
      fx.classList.remove("pop-now"); void fx.offsetWidth; fx.classList.add("pop-now");
      fx.closest(".hnode")?.classList.add("is-revealed");
    }

    // chip + count
    const chip = allNodes[i]?.querySelector(".hchip");
    if (chip) chip.classList.add("chip-show");
    const countEl = allNodes[i]?.querySelector(".hnode-count");
    if (countEl) countEl.setAttribute("visibility", "visible");

    // stat
    const incomeNow = HERO.cumIncome[heroStep] || 0;
    setHeroStat($("#heroTeam"),   heroStep,   "");
    setHeroStat($("#heroIncome"), incomeNow, "฿");
    updateCompanySales(heroStep);
    const wa = $("#withdrawAmount");
    if (wa) wa.textContent = "฿" + num(incomeNow);

    // เลื่อน SVG ให้เห็น node ล่าสุด
    const svgWrap = $("#heroNet")?.closest(".heronet-wrap") || $("#heroNet")?.parentElement;
    if (svgWrap) svgWrap.scrollTo({ left: svgWrap.scrollWidth, behavior: "smooth" });

    heroAnimBusy = false;
    const lbl = btn && btn.querySelector(".hrb-label");
    if (lbl) lbl.textContent = `ถัดไป →`;

    // popup เมื่อครบ 10 คน
    // รอให้ตัวเลขสมาชิกและรายได้ count-up จบก่อน แล้วค่อยแสดงป็อปอัพ
    if (heroStep >= 10) {
      renderHeroRowSummary("g1", 108, heroStep, incomeNow, heroStep);
    }
    if (heroStep === 10) {
      setTimeout(showRevenueShare, 750);
    }
  }, LINE_DURATION + 80);
}

/* compat shim — ไม่ได้ใช้แล้ว แต่ป้องกัน reference error */
function playHeroSequence() { revealAllHero(); }

/* แสดงทุก 10 node พร้อมกันในครั้งเดียว */
function revealAllHero() {
  if (heroAnimBusy) return;
  // ถ้าเปิดหมดแล้ว ให้ reset
  if (heroStep >= HERO.chain.length - 1) { resetHeroAnim(); return; }

  heroAnimBusy = true;

  const allLinks = $$("#heroLinks .hlink");
  const allNodes = $$("#heroNodes .hnode");
  const allFx    = $$("#heroNodes .hnode .hfx");

  // วาดทุกเส้นพร้อมกัน
  allLinks.forEach((link, i) => {
    setTimeout(() => {
      link.style.transition = `stroke-dashoffset ${LINE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
      link.style.strokeDashoffset = "0";
    }, i * 40);
  });

  // pop ทุก node พร้อมกัน (เริ่มหลังเส้น)
  setTimeout(() => {
    allFx.forEach((fx, i) => {
      if (i === 0) return; // "คุณ" reveal แล้ว
      setTimeout(() => {
        fx.classList.remove("pop-now"); void fx.offsetWidth; fx.classList.add("pop-now");
        const node = fx.closest(".hnode");
        if (node) {
          node.classList.add("is-revealed");
          node.querySelector(".hchip")?.classList.add("chip-show");
          const countEl = node.querySelector(".hnode-count");
          if (countEl) countEl.setAttribute("visibility", "visible");
        }
      }, i * 40);
    });

    heroStep = HERO.chain.length - 1;
    const incomeNow = HERO.cumIncome[heroStep] || 0;

    setTimeout(() => {
      setHeroStat($("#heroTeam"),   heroStep, "");
      setHeroStat($("#heroIncome"), incomeNow, "฿");
      updateCompanySales(heroStep);
      const wa = $("#withdrawAmount");
      if (wa) wa.textContent = "฿" + num(incomeNow);

      const svgWrap = $("#heroNet")?.closest(".heronet-wrap") || $("#heroNet")?.parentElement;
      if (svgWrap) svgWrap.scrollTo({ left: svgWrap.scrollWidth, behavior: "smooth" });

      heroAnimBusy = false;
      renderHeroRowSummary("g1", 108, 10, 3500, 10);
      // setHeroStat ใช้เวลา 620ms จึงเว้นระยะให้แสดง 10 คน / ฿3,500 ครบก่อน
      setTimeout(showRevenueShare, 750);
      setTimeout(branchFromPerson1, 1200);
    }, allFx.length * 40 + 200);
  }, LINE_DURATION * 0.4);
}

/* ======================================================
   CLICK HANDLER สำหรับ "คุณ"
   กด 1 ครั้งแรก → auto-reveal 10 คน ทีละคน (stagger)
   กดครั้งถัดไป  → เพิ่มทีละ 1 คน
   ====================================================== */
function handleYouClick() {
  if (heroAnimBusy) return;
  if (heroStep === 0) {
    // กดครั้งที่ 1 → auto-reveal ครบ 10 คนทันที
    autoRevealRest();
  } else if (heroStep < 10) {
    autoRevealRest();
  } else {
    // หลังครบ 10 คนแล้ว เพิ่มคนที่ 11, 12, ... ได้ต่อเนื่อง
    advanceHeroStep();
  }
}

/* ตัวแปร track auto-sequence */
let autoSeqCount  = 0;
let autoSeqTarget = 0;

/* auto-reveal คนที่เหลือจนครบ 10 (เริ่มจาก heroStep ปัจจุบัน) */
function autoRevealRest() {
  autoSeqCount  = heroStep; // ที่ revealed ไปแล้ว
  autoSeqTarget = 10;
  doAutoStep();
}

/* เรียก advanceHeroStep — force clear busy แล้ว step ต่อไป */
function doAutoStep() {
  if (autoSeqCount >= autoSeqTarget) {
    return;
  }
  autoSeqCount++;
  heroAnimBusy = false; // force-clear เพื่อป้องกัน stuck
  advanceHeroStep();
  setTimeout(doAutoStep, LINE_DURATION + 150);
}

/* ======================================================
   BRANCH ROW 2 — กดคนที่ 1 → แสดง G2 row อัตโนมัติ
   G2-1 = +350 / G2-2 ขึ้นไป = +100
   ====================================================== */
const G2_R      = 18;
const G2_X_STEP = 74;
const ROW_Y_STEP = 145;
let g2StartX    = 0;
let g3Active    = false;
const branchRowStates = {};
let r2Node1Clicks = 0;

function branchFromPerson1() {
  if (branchActive) return;
  const node1 = HERO.chain[1];
  if (!node1 || !document.querySelector("#heroNodes .hnode[data-level='1'].is-revealed")) return;

  branchActive = true;
  g2StartX = node1.x; // เริ่มต้น row 2 ตรงใต้คนที่ 1

  const svg = $("#heroNet");
  if (!svg) return;

  const vb = svg.viewBox.baseVal;
  vb.height = BRANCH_Y + G2_R + 34;

  // เส้นแนวตั้งจาก person 1 ลงสู่ row 2
  const linksEl = $("#heroLinks");
  const x  = node1.x;
  const y1 = node1.y + node1.r;
  const y2 = BRANCH_Y - G2_R;
  const len = Math.round(y2 - y1);

  const vlink = document.createElementNS("http://www.w3.org/2000/svg", "path");
  vlink.setAttribute("class", "hlink");
  vlink.setAttribute("data-level", "r2-vlink");
  vlink.setAttribute("data-len", len);
  vlink.setAttribute("d", `M ${x} ${y1} L ${x} ${y2}`);
  vlink.setAttribute("stroke-dasharray", len);
  vlink.setAttribute("stroke-dashoffset", len);
  linksEl.appendChild(vlink);

  requestAnimationFrame(() => {
    vlink.style.transition = `stroke-dashoffset ${LINE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
    vlink.style.strokeDashoffset = "0";
  });

  // auto-reveal G2 nodes ทีละคน หลังเส้นวาด (แสดง 1,2,3... +10 ก่อน)
  setTimeout(() => {
    autoRevealRow(g2StartX, BRANCH_Y, "r2", G2_R, 10, branchChip, onG2NodeCreated, null);
  }, LINE_DURATION + 80);
}

function branchChip(depth) {
  return "+10";
}

function branchCount(depth) {
  return num(Math.pow(10, Math.max(1, depth)));
}

function renderHeroRowSummary(id, y, people, total, visibleNodes = 10) {
  const nodesEl = document.getElementById("heroNodes");
  const svg = document.getElementById("heroNet");
  if (!nodesEl || !svg) return;

  document.getElementById(`heroSummary-${id}`)?.remove();
  const summary = document.createElementNS("http://www.w3.org/2000/svg", "g");
  summary.id = `heroSummary-${id}`;
  summary.setAttribute("class", "hero-row-summary");
  const width = Math.max(714, (visibleNodes - 1) * G2_X_STEP + 48);
  const dividerX = 100 + width / 2;
  summary.innerHTML = `
    <rect x="100" y="${y}" width="${width}" height="40" rx="10"></rect>
    <text x="124" y="${y + 21}" class="hero-row-summary-label">จำนวนคน</text>
    <text x="220" y="${y + 21}" class="hero-row-summary-value">${num(people)} คน</text>
    <line x1="${dividerX}" y1="${y + 9}" x2="${dividerX}" y2="${y + 31}"></line>
    <text x="${dividerX + 26}" y="${y + 21}" class="hero-row-summary-label">ยอดรวม</text>
    <text x="${dividerX + 116}" y="${y + 21}" class="hero-row-summary-value">฿${num(total)}</text>`;
  nodesEl.appendChild(summary);

  const vb = svg.viewBox.baseVal;
  if (y + 50 > vb.height) vb.height = y + 50;
}

function collapseSecondRowTo100() {
  if (!branchActive || branchCollapsed) return;
  branchCollapsed = true;

  document.querySelectorAll("#heroNodes .hnode[data-level^='r2-']").forEach((node) => {
    const countEl = node.querySelector(".hnode-count");
    if (countEl) countEl.textContent = "10";
    const chip = node.querySelector(".hchip-line1");
    if (chip) chip.textContent = "+100";
  });
  renderHeroRowSummary("g2", 262, 100, 1000);

  // แสดงผลลัพธ์ทบกำลังครบ G1-G8 ด้วยฐาน 10 คนตามลำดับในตัวอย่าง
  if (directInput && dupInput) {
    directInput.value = "10";
    dupInput.value = "10";
    calculate();
  }
}

function onG2NodeCreated(wrap, idx) {
  // การคลิกใช้ event delegation ใน initHeroInteractions
}

function handleBranchRowClick(parentNode, parentDepth) {
  if (parentDepth >= MAX_GEN) return;

  // r2-1 (คนที่ 1 ใน G2): กด → cascade G3-G8 อัตโนมัติ
  if (parentDepth === 2) {
    let d = 3;
    const revealNext = () => {
      if (d > MAX_GEN) return;
      handleBranchRowClickByDepth(d - 1, () => { d++; revealNext(); });
    };
    revealNext();
    return;
  }

  const state = branchRowStates[parentDepth] || { created: false, scaled: false };
  branchRowStates[parentDepth] = state;
  const childDepth = parentDepth + 1;
  const childPrefix = `r${childDepth}`;

  if (state.created) {
    if (state.scaled) return;
    state.scaled = true;
    const perNode = Math.pow(10, childDepth - 1);
    document.querySelectorAll(`#heroNodes .hnode[data-level^='${childPrefix}-']`).forEach((node) => {
      const countEl = node.querySelector(".hnode-count");
      if (countEl) countEl.textContent = num(perNode);
      const chip = node.querySelector(".hchip-line1");
      if (chip) chip.textContent = "+100";
    });
    const childNode = document.querySelector(`#heroNodes .hnode[data-level='${childPrefix}-1']`);
    const childY = getHeroNodeY(childNode);
    renderHeroRowSummary(`g${childDepth}`, childY + 47, perNode * 10, perNode * 10 * G_RATE);
    return;
  }
  state.created = true;

  const tf = parentNode.getAttribute("transform") || "";
  const m  = tf.match(/translate\(([0-9.]+)\s+([0-9.]+)\)/);
  if (!m) return;
  const nodeX = parseFloat(m[1]);
  const nodeY = parseFloat(m[2]);
  const childY = nodeY + ROW_Y_STEP;

  const svg = $("#heroNet");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  if (childY + G2_R + 34 > vb.height) vb.height = childY + G2_R + 34;

  const linksEl = $("#heroLinks");
  const y1  = nodeY + G2_R;
  const y2  = childY - G2_R;
  const len = Math.round(y2 - y1);

  const vlink = document.createElementNS("http://www.w3.org/2000/svg", "path");
  vlink.setAttribute("class", "hlink");
  vlink.setAttribute("data-level", `${childPrefix}-vlink`);
  vlink.setAttribute("data-len", len);
  vlink.setAttribute("d", `M ${nodeX} ${y1} L ${nodeX} ${y2}`);
  vlink.setAttribute("stroke-dasharray", len);
  vlink.setAttribute("stroke-dashoffset", len);
  linksEl.appendChild(vlink);

  requestAnimationFrame(() => {
    vlink.style.transition = `stroke-dashoffset ${LINE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
    vlink.style.strokeDashoffset = "0";
  });

  setTimeout(() => {
    autoRevealRow(
      nodeX,
      childY,
      childPrefix,
      G2_R,
      10,
      branchChip,
      null
    );
  }, LINE_DURATION + 80);
}

function getHeroNodeY(node) {
  const match = (node?.getAttribute("transform") || "").match(/translate\([0-9.]+\s+([0-9.]+)\)/);
  return match ? Number(match[1]) : 0;
}

/* ======================================================
   GENERIC ROW AUTO-REVEAL — ใช้ร่วมกันสำหรับ G2 และ G3
   ====================================================== */
function autoRevealRow(startX, rowY, prefix, r, total, chipFn, onCreate, onAllDone) {
  let count = 0;
  const rowDepth = Number(prefix.match(/^r([2-8])$/)?.[1] || 2);
  const doNext = () => {
    if (count >= total) {
      if (onAllDone) onAllDone();
      return;
    }
    count++;
    const x = startX + (count - 1) * G2_X_STEP;
    spawnRowNode(x, rowY, count, prefix, r, chipFn(rowDepth, count), String(count), onCreate);
    if (count < total) setTimeout(doNext, 350);
    else setTimeout(() => { if (onAllDone) onAllDone(); }, 100);
  };
  doNext();
}

/* scale node counts + chips + render summary box สำหรับชั้น depth ที่กำหนด */
function scaleAndSummarizeGen(depth, rowY) {
  const prefix = `r${depth}`;
  const perNode = Math.pow(10, depth - 1);
  document.querySelectorAll(`#heroNodes .hnode[data-level^='${prefix}-']`).forEach((node) => {
    const countEl = node.querySelector(".hnode-count");
    if (countEl) countEl.textContent = num(perNode);
    const chip = node.querySelector(".hchip-line1");
    if (chip) chip.textContent = "+100";
  });
  const people = perNode * 10;
  renderHeroRowSummary(`g${depth}`, rowY + 47, people, people * G_RATE);
}

function autoRevealNextGen(depth) {
  if (depth > MAX_GEN) return;
  const prefix = `r${depth}`;
  const firstNode = document.querySelector(`#heroNodes .hnode[data-level='${prefix}-1']`);
  if (!firstNode) return;
  const state = branchRowStates[depth - 1] || { created: false, scaled: false };
  if (!state.created) {
    branchRowStates[depth - 1] = { created: false, scaled: false };
    handleBranchRowClickByDepth(depth - 1, () => autoRevealNextGen(depth + 1));
  }
}

function handleBranchRowClickByDepth(parentDepth, onDone) {
  if (parentDepth >= MAX_GEN) { if (onDone) onDone(); return; }
  const state = branchRowStates[parentDepth] || { created: false, scaled: false };
  if (state.created) { if (onDone) onDone(); return; }
  state.created = true;
  branchRowStates[parentDepth] = state;

  const childDepth = parentDepth + 1;
  const childPrefix = `r${childDepth}`;
  const parentPrefix = `r${parentDepth}`;
  const parentNode = document.querySelector(`#heroNodes .hnode[data-level='${parentPrefix}-1']`);
  if (!parentNode) { if (onDone) onDone(); return; }

  const tf = parentNode.getAttribute("transform") || "";
  const m  = tf.match(/translate\(([0-9.]+)\s+([0-9.]+)\)/);
  if (!m) { if (onDone) onDone(); return; }
  const nodeX = parseFloat(m[1]);
  const nodeY = parseFloat(m[2]);
  const childY = nodeY + ROW_Y_STEP;

  const svg = $("#heroNet");
  if (!svg) { if (onDone) onDone(); return; }
  const vb = svg.viewBox.baseVal;
  if (childY + G2_R + 34 > vb.height) vb.height = childY + G2_R + 34;

  const linksEl = $("#heroLinks");
  const y1 = nodeY + G2_R;
  const y2 = childY - G2_R;
  const len = Math.round(y2 - y1);
  const vlink = document.createElementNS("http://www.w3.org/2000/svg", "path");
  vlink.setAttribute("class", "hlink");
  vlink.setAttribute("data-level", `${childPrefix}-vlink`);
  vlink.setAttribute("data-len", len);
  vlink.setAttribute("d", `M ${nodeX} ${y1} L ${nodeX} ${y2}`);
  vlink.setAttribute("stroke-dasharray", len);
  vlink.setAttribute("stroke-dashoffset", len);
  linksEl.appendChild(vlink);
  requestAnimationFrame(() => {
    vlink.style.transition = `stroke-dashoffset ${LINE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
    vlink.style.strokeDashoffset = "0";
  });

  setTimeout(() => {
    autoRevealRow(nodeX, childY, childPrefix, G2_R, 10, branchChip, null, () => {
      scaleAndSummarizeGen(childDepth, childY);
      if (onDone) onDone();
    });
  }, LINE_DURATION + 80);
}

function spawnRowNode(x, y, idx, prefix, r, chipText, countText, onCreate) {
  const nodesEl = $("#heroNodes");
  const linksEl = $("#heroLinks");
  if (!nodesEl) return;

  // เส้นแนวนอนจาก node ก่อนหน้า
  if (idx > 1) {
    const prevX = x - G2_X_STEP;
    const x1 = prevX + r, x2 = x - r;
    const len = Math.round(x2 - x1);
    const hl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hl.setAttribute("class", "hlink");
    hl.setAttribute("data-level", `${prefix}-h${idx}`);
    hl.setAttribute("data-len", len);
    hl.setAttribute("d", `M ${x1} ${y} L ${x2} ${y}`);
    hl.setAttribute("stroke-dasharray", len);
    hl.setAttribute("stroke-dashoffset", len);
    linksEl.appendChild(hl);
    requestAnimationFrame(() => {
      hl.style.transition = `stroke-dashoffset ${Math.round(LINE_DURATION * 0.65)}ms cubic-bezier(0.4,0,0.2,1)`;
      hl.style.strokeDashoffset = "0";
    });
  }

  // ขยาย viewBox
  const svg = $("#heroNet");
  if (svg) {
    const vb = svg.viewBox.baseVal;
    if (x + r + 20 > vb.width) vb.width = x + r + 20;
  }

  const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
  wrap.setAttribute("class", "hnode l1");
  wrap.setAttribute("data-level", `${prefix}-${idx}`);
  wrap.setAttribute("transform", `translate(${x} ${y})`);
  wrap.innerHTML = `
    <g class="hfx">
      <circle class="hicon-head" cx="0" cy="-11" r="9"></circle>
      <path class="hicon-body" d="M -13 8 C -13 -3 13 -3 13 8"></path>
    </g>
    <g class="hchip chip-show" transform="translate(0 -34)">
      <rect x="-22" y="-12" width="44" height="24" rx="12"></rect>
      <text x="0" y="5" class="hchip-line1">${chipText}</text>
    </g>
    <text class="hnode-count" x="0" y="22" visibility="visible">${countText}</text>`;

  nodesEl.appendChild(wrap);
  const dynamicDepth = Number(prefix.match(/^r([2-8])$/)?.[1]);
  if (idx === 1 && dynamicDepth) {
    wrap.addEventListener("click", (event) => {
      event.stopPropagation();
      handleBranchRowClick(wrap, dynamicDepth);
    });
  }

  const delay = idx > 1 ? Math.round(LINE_DURATION * 0.55) : 0;
  setTimeout(() => {
    const fx = wrap.querySelector(".hfx");
    fx.classList.remove("pop-now"); void fx.offsetWidth; fx.classList.add("pop-now");
    wrap.classList.add("is-revealed");
    // scroll SVG ให้เห็น node ใหม่
    const svgWrap = $("#heroNet")?.closest(".heronet-wrap") || $("#heroNet")?.parentElement;
    if (svgWrap) svgWrap.scrollTo({ left: svgWrap.scrollWidth, behavior: "smooth" });
  }, delay);

  if (onCreate) onCreate(wrap, idx);
}

function renderHeroNet() {
  const linksEl = $("#heroLinks");
  const nodesEl = $("#heroNodes");
  if (!linksEl) return;

  const nodes = HERO.chain;

  // render horizontal links with dashoffset (hidden initially)
  linksEl.innerHTML = nodes
    .slice(1)
    .map((n, i) => heroLinkH(nodes[i], n, n.level))
    .join("");

  // render nodes (no pop class yet — animation sets it)
  nodesEl.innerHTML = nodes
    .map((n) =>
      heroNode({
        ...n,
        pop: "",
        aria:
          n.level === 0
            ? "คุณ — ฐานของสายงาน"
            : `${n.side} แนะนำรับ ${n.pct}${n.level === HERO.lineDepth ? " — กดเพื่อเปิดเมทริกโบนัส" : ""}`,
      })
    )
    .join("");

  // แสดงเฉพาะ "คุณ" node ก่อน ที่เหลือรอกด
  const firstNode0 = document.querySelector("#heroNodes .hnode");
  const firstFx0   = firstNode0?.querySelector(".hfx");
  if (firstFx0) { firstFx0.classList.remove("pop-now"); void firstFx0.offsetWidth; firstFx0.classList.add("pop-now"); }
  if (firstNode0) firstNode0.classList.add("is-revealed");

  // วง "คุณ" (level 0) ทำหน้าที่เป็นปุ่ม ▶
  const youNode = document.querySelector("#heroNodes .hnode[data-level='0']");
  if (youNode) {
    youNode.classList.add("is-trigger");
    youNode.addEventListener("click", handleYouClick);
    youNode.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") handleYouClick(); });
  }

  // ซ่อนปุ่มแยก
  const btn = $("#heroReplayBtn");
  if (btn) btn.style.display = "none";
}

/* ---- footer stat tween (gives the "LIVE" numbers a lively feel) ---- */
function setHeroStat(el, value, prefix) {
  if (!el) return;
  const from = Number(el.dataset.val || 0);
  el.dataset.val = value;
  if (from === value) { el.textContent = prefix + num(value); return; }
  // count-up via setInterval (works in background tabs unlike rAF)
  const dur = 620;
  const steps = 24;
  const interval = dur / steps;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    const p = step / steps;
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + num(Math.round(from + (value - from) * eased));
    if (step >= steps) { clearInterval(timer); el.textContent = prefix + num(value); }
  }, interval);
}

// Match the reference card in the screenshot: ฿12,000 and 1% = ฿120
let liveCompanySales = 12000;

function updateCompanySales() {
  const el = document.getElementById("companySales");
  if (el) {
    el.textContent = baht(liveCompanySales);
    el.classList.remove("is-updating");
    void el.offsetWidth;
    el.classList.add("is-updating");
  }
  const shareEl = document.getElementById("companyShare");
  if (shareEl) shareEl.textContent = baht(liveCompanySales * 0.01);
  return liveCompanySales;
}

let waitCount = 10;
function updateWaitCount() {
  const el = document.getElementById("matrixWaitCount");
  if (!el) return;
  el.textContent = num(waitCount) + " คน";
}

updateCompanySales();
updateWaitCount();
setInterval(() => {
  liveCompanySales += 1000;
  updateCompanySales();
  waitCount += 1;
  updateWaitCount();
}, 5000);

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
  const liveMessage = $(".hero-live-message");
  let pinned = null; // depth level that is locked in, or null
  let hasShownPurchaseTip = false;
  let purchaseTipPinned = false;

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
    if (purchaseTipPinned && lv !== 0) return;
    let title, sub;
    if (lv === 0) {
      if (hasShownPurchaseTip) {
        tip.classList.remove("show");
        return;
      }
      hasShownPurchaseTip = true;
      purchaseTipPinned = true;
      tip.classList.add("purchase-pinned", "purchase-tip");
      liveMessage?.classList.add("is-visible", "is-pinned");
      title = "ซื้อสินค้า 1,000 บาท";
      sub = "";
    } else {
      title = `คน ${lv} · แนะนำ 350/คน`;
      sub = "";
    }
    tip.innerHTML = sub ? `<b>${title}</b><span>${sub}</span>` : `<b>${title}</b>`;
    const cb = card.getBoundingClientRect();
    const nb = node.querySelector("circle").getBoundingClientRect();
    tip.style.left = `${nb.left + nb.width / 2 - cb.left}px`;
    tip.style.top = lv === 0
      ? `${nb.bottom - cb.top}px`
      : `${nb.top - cb.top}px`;
    tip.classList.add("show");
  };
  const hideTip = () => tip && tip.classList.remove("show", "purchase-pinned", "purchase-tip");
  const showPurchaseLabel = () => {
    const youNode = document.querySelector("#heroNodes .hnode[data-level='0']");
    if (!youNode || youNode.querySelector(".hyou-purchase-label")) return;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "g");
    label.setAttribute("class", "hyou-purchase-label");
    label.innerHTML = `
      <text x="0" y="29">ซื้อสินค้า</text>
      <text class="hyou-purchase-amount" x="0" y="43">1,000</text>`;
    youNode.appendChild(label);
  };

  const drillFooter = (depth) => {
    if (depth === null || depth === 0) {
      teamLabel.textContent = "สมาชิก";
      incomeLabel.textContent = "ค่าแนะนำ";
      // แสดงเฉพาะ step ที่เปิดแล้ว (ไม่โชว์ค่าเต็มก่อนกด)
      setHeroStat($("#heroTeam"),   heroStep, "");
      setHeroStat($("#heroIncome"), HERO.cumIncome[heroStep] || 0, "฿");
    } else {
      // แสดงได้แค่ถึง step ที่เปิดแล้ว
      const showDepth = Math.min(depth, heroStep);
      teamLabel.textContent = `สมาชิกถึงชั้น ${showDepth}`;
      incomeLabel.textContent = "รายได้สะสม/เดือน";
      setHeroStat($("#heroTeam"),   showDepth, "");
      setHeroStat($("#heroIncome"), HERO.cumIncome[showDepth] || 0, "฿");
    }
  };

  const preview = (node) => {
    if (liveMessage?.classList.contains("is-pinned")) liveMessage.classList.add("is-visible");
    else liveMessage?.classList.toggle("is-visible", Number(node.dataset.level) === 0);
    setActiveDepth(Number(node.dataset.level));
    showTip(node);
  };
  const clearPreview = () => {
    if (!liveMessage?.classList.contains("is-pinned")) liveMessage?.classList.remove("is-visible");
    setActiveDepth(pinned);
    if (purchaseTipPinned) tip?.classList.add("show", "purchase-pinned");
    else hideTip();
  };

  const select = (node) => {
    if (Number(node.dataset.level) === 0) {
      liveMessage?.classList.add("is-visible", "is-pinned");
    }
    if (purchaseTipPinned) {
      purchaseTipPinned = false;
      hideTip();
      showPurchaseLabel();
      liveMessage?.classList.add("is-visible", "is-pinned");
    }
    const lvStr = node.dataset.level;
    if (lvStr && lvStr.startsWith("r2")) return;
    const depth = Number(lvStr);

    if (depth === 1 && node.classList.contains("is-revealed")) {
      if (!branchActive) {
        branchFromPerson1();
      } else {
        collapseSecondRowTo100();
      }
      return;
    }
    if (depth === 2 && node.classList.contains("is-revealed")) {
      highlightMatrix();
    }
    if (depth === 3 && node.classList.contains("is-revealed")) {
      triggerMatrixBonus();
      return;
    }
    if (depth === 10) {
      if (node.classList.contains("is-revealed")) showRevenueShare();
      return; // ป้องกัน showMatrixBonus ทุกกรณี
    }
    pinned = pinned === depth ? null : depth;
    setActiveDepth(pinned);
    drillFooter(pinned);
    if (depth === HERO.lineDepth && depth !== 10) showMatrixBonus();
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

  // รองรับคนแรกของแถวที่สร้างแบบ dynamic ตั้งแต่ G2 ถึง G8
  svg.addEventListener("click", (e) => {
    const node = e.target.closest(".hnode");
    const match = node?.dataset.level?.match(/^r([2-8])-1$/);
    if (match) handleBranchRowClick(node, Number(match[1]));
  });

  // click empty card area to reset the pinned selection
  card.addEventListener("click", (e) => {
    if (e.target.closest(".hnode")) return;
    if (purchaseTipPinned) {
      purchaseTipPinned = false;
      hideTip();
      showPurchaseLabel();
      liveMessage?.classList.add("is-visible", "is-pinned");
    }
    pinned = null;
    setActiveDepth(null);
    drillFooter(null);
  });

  setActiveDepth(null);
}

/* ============================================================
   DEPTH TREE — ผังชั้น G1–G8 แบบทบกำลัง (อ่านง่าย ไม่เบียด)
   ============================================================ */
function renderDepthTree(gens) {
  const el = $("#depthTree");
  if (!el) return;

  // log scale for bar widths (ตัวเลขโตแบบทบกำลัง)
  const logMax = Math.log10(Math.max(...gens.map((t) => t.inc), 10));

  el.innerHTML = `
    <div class="dt-you">
      <span class="dt-you-ic">🧍</span>
      <div class="dt-you-meta"><b>คุณ</b><small>ซื้อสินค้า ฿1,000</small></div>
    </div>
    <div class="dt-tiers">
      ${gens
        .map((t) => {
          const w = Math.max(14, (Math.log10(Math.max(t.inc, 1)) / logMax) * 100);
          return `
        <div class="dt-tier" style="--i:${t.g}">
          <span class="dt-badge">G${t.g}</span>
          <div class="dt-bar"><span class="dt-bar-fill" style="width:${w}%"></span></div>
          <div class="dt-meta">
            <span class="dt-count">${num(t.count)} คน</span>
            <span class="dt-rate">${t.rate} บาท/คน</span>
          </div>
          <span class="dt-income">${baht(t.inc)}</span>
        </div>`;
        })
        .join("")}
    </div>
    `;
  // wire G1 bonus button each time tree is re-rendered
  const g1Btn = el.querySelector("#g1BonusBtn");
  if (g1Btn) g1Btn.addEventListener("click", showRevenueShare);
}

/* ============================================================
   SIMULATOR
   ============================================================ */
const directInput = $("#directInput");
const dupInput = $("#dupInput");

function calculate() {
  const direct = Number(directInput.value);
  const dup    = Number(dupInput.value);
  const m      = model(direct, dup);

  $("#directOut").value = direct;
  $("#dupOut").value    = dup;

  $("#teamTotal").textContent   = num(m.team);
  $("#incomeTotal").textContent = num(m.income);

  const scenarioEl = $("#scenarioLabel");
  if (scenarioEl) scenarioEl.textContent =
    direct < 5 ? "เริ่มต้น" : direct < 20 ? "กำลังขยายทีม" : "ทีมเติบโตเร็ว";

  renderDepthTree(m.gens);
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
    status.textContent = `ขอบคุณคุณ ${name}! ทีมงาน Innova Life จะติดต่อกลับโดยเร็วที่สุด 🌿`;
    form.reset();
  });
}

/* กดคนที่ 2 → เลื่อนไป Matrix + กระพริบไฮไลท์ */
function highlightMatrix() {
  const section = document.getElementById("matrixTable");
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  const grid = section.querySelector(".matrix-table-grid");
  if (grid) {
    grid.classList.remove("matrix-flash");
    void grid.offsetWidth;
    grid.classList.add("matrix-flash");
    setTimeout(() => grid.classList.remove("matrix-flash"), 1000);
  }
}

/* กดคนที่ 3 → ช่องที่ 3 เต็ม + ปลดล็อก + popup รับรายได้ */
function triggerMatrixBonus() {
  // เติมช่องที่ 3
  const slot3 = document.getElementById("mtcSlot3");
  if (slot3 && slot3.classList.contains("empty")) {
    slot3.classList.remove("empty");
    slot3.innerHTML = `<span class="mtc-icon">🧑</span>
      <span class="mtc-label">ช่องที่ 3</span>
      <span class="mtc-status filled">มีสมาชิกแล้ว</span>`;
  }

  // ปลดล็อก matrix card (hero section)
  const lock = document.getElementById("matrixLock");
  if (lock) { lock.style.transition = "opacity 0.5s ease"; lock.style.opacity = "0"; setTimeout(() => { lock.style.display = "none"; }, 500); }
  const tag = document.getElementById("matrixUnlockedTag");
  if (tag) tag.style.display = "inline-flex";

  // เลื่อนไป Matrix section
  setTimeout(() => document.getElementById("matrixTable")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);

  // popup รับรายได้
  setTimeout(() => showIncomePopup(), 800);
}

function showIncomePopup() {
  if (document.getElementById("incomePopup")) return;
  const popup = document.createElement("div");
  popup.id = "incomePopup";
  popup.className = "matrix-popup-overlay";
  popup.innerHTML = `
    <div class="matrix-popup bonus-received-popup" role="dialog" aria-modal="true" aria-labelledby="bonusReceivedTitle">
      <button class="matrix-popup-close" aria-label="ปิด">✕</button>
      <div class="bonus-confetti" aria-hidden="true">🎉</div>
      <h3 class="matrix-popup-title" id="bonusReceivedTitle">ครบ 3 คนแล้ว!</h3>
      <p class="bonus-unlocked">เมทริกโบนัสปลดล็อกสำเร็จ</p>
      <div class="bonus-total">
        <span>รับโบนัสเข้ากระเป๋าทันที</span>
        <strong>฿1,500</strong>
      </div>
      <div class="bonus-breakdown">
        <div><span>โบนัสสด</span><b>฿500</b></div>
        <div><span>เครดิตสินค้า</span><b>฿1,000</b></div>
      </div>
      <p class="bonus-next">ระบบจะเกิดใหม่อัตโนมัติ<br>และเริ่มรอบถัดไปทันที ♻️</p>
    </div>`;
  document.body.appendChild(popup);
  const close = () => {
    popup.remove();
    document.querySelector(".rebuy-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  popup.querySelector(".matrix-popup-close").addEventListener("click", close);
  popup.addEventListener("click", (e) => { if (e.target === popup) close(); });
  requestAnimationFrame(() => popup.classList.add("is-in"));
  setTimeout(close, 5000);
}

/* ============================================================
   MATRIX BONUS — show when node level-3 is clicked
   ============================================================ */
function initMatrixBonus() {
  // กดช่องที่ 3 → ผลเหมือนกดคนที่ 3 ในเครือข่าย
  const slot3 = document.getElementById("mtcSlot3");
  if (slot3) slot3.addEventListener("click", () => triggerMatrixBonus());
}

/* +1% ส่วนแบ่งจากยอดขายของบริษัท popup — เมื่อกดผัง Matrix */
function showRevenueShare() {
  if (document.getElementById("matrixPopup")) return;
  const companySales = updateCompanySales(heroStep);
  const revenueShare = companySales * 0.01;

  const popup = document.createElement("div");
  popup.id = "matrixPopup";
  popup.className = "matrix-popup-overlay";
  popup.innerHTML = `
    <div class="matrix-popup" role="dialog" aria-modal="true">
      <button class="matrix-popup-close" aria-label="ปิด">✕</button>
      <div class="matrix-popup-lock">🎁</div>
      <h3 class="matrix-popup-title">รับโบนัสเพิ่ม</h3>
      <p class="matrix-popup-sub">เมื่อแนะนำสมาชิกครบ <b>10 คน</b></p>
      <div class="matrix-popup-reward">
        <span class="mpr-rate">1%</span>
        <span class="mpr-desc">ยอดขายทั้งหมดของ <strong class="mpr-company">บริษัท</strong></span>
      </div>
    </div>`;
  document.body.appendChild(popup);

  const close = () => {
    popup.remove();
    const salesBox = document.querySelector(".company-sales");
    if (salesBox) {
      salesBox.classList.add("is-visible");
      salesBox.setAttribute("aria-hidden", "false");
    }
  };
  popup.querySelector(".matrix-popup-close").addEventListener("click", close);
  popup.addEventListener("click", (e) => { if (e.target === popup) close(); });

  requestAnimationFrame(() => popup.classList.add("is-in"));
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
      <h3 class="matrix-popup-title">ปลดล็อกแล้ว!</h3>
      <p class="matrix-popup-sub">เข้าสู่ผัง <b>Matrix</b></p>
      <div class="matrix-popup-reward">
        <span class="mpr-desc">Matrix Bonus ครบ 3 ช่อง รับโบนัสทันที</span>
        <span class="mpr-pct">฿1,500</span>
      </div>
      <p class="matrix-popup-note">กำลังพาคุณเข้าสู่ตาราง Matrix…</p>
    </div>`;
  document.body.appendChild(popup);

  let entered = false;
  const enterMatrix = () => {
    if (entered) return;
    entered = true;
    document.getElementById("matrixTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const close = () => { popup.remove(); enterMatrix(); };

  popup.querySelector(".matrix-popup-close").addEventListener("click", close);
  popup.addEventListener("click", (e) => { if (e.target === popup) close(); });

  requestAnimationFrame(() => popup.classList.add("is-in"));
  setTimeout(close, 2600);
}

/* ============================================================
   INIT
   ============================================================ */
$("#yr").textContent = new Date().getFullYear();
renderHeroNet();
initHeroInteractions();
initMatrixBonus();
calculate();

[directInput, dupInput].forEach((input) =>
  input && input.addEventListener("input", calculate)
);

initNav();
initReveal();
initContact();
