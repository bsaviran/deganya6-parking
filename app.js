import { PEOPLE, CARS, firebaseConfig } from "./config.js";

const NAMES = PEOPLE.map((p) => p.name);
const CAR_NAMES = CARS.map((c) => c.name);
const OTHER = "רכב אחר";
const OTHER_COLOR = "#a3a3a3";
// ניסוח לפי מגדר: g(name, "חנה", "חנתה")
const g = (name, m, f) => (PEOPLE.find((p) => p.name === name)?.female ? f : m);
// "האקספנג" אבל "רכב של השכן" (בלי ה' כפולה לשם חופשי)
const the = (car) => (CAR_NAMES.includes(car) ? `ה${car}` : car || "הרכב");
const carColor = (car) => CARS.find((c) => c.name === car)?.color || OTHER_COLOR;

const $ = (id) => document.getElementById(id);
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const DEMO = firebaseConfig.apiKey === "REPLACE_ME";
const EMPTY = { parkedBy: null, parkedCar: null, parkedAt: null, blockedBy: null, blockedCar: null, blockedAt: null, note: "" };
const CLEAR = { parkedBy: null, parkedCar: null, parkedAt: null, blockedBy: null, blockedCar: null, blockedAt: null };
const CLEAR_BLOCK = { blockedBy: null, blockedCar: null, blockedAt: null };

let me = LS.get("me");
let code = LS.get("code");
let state = { ...EMPTY };
let lastData = null;
let store = null;

// ---------- Store: Firebase (אמיתי) או localStorage (מצב הדגמה) ----------
async function createStore(code) {
  if (DEMO) {
    const key = "demo-state";
    const listeners = [];
    const read = () => JSON.parse(LS.get(key) || "null") || { state: EMPTY, history: [] };
    const emit = () => listeners.forEach((fn) => fn(read()));
    window.addEventListener("storage", (e) => e.key === key && emit());
    return {
      subscribe(fn) { listeners.push(fn); fn(read()); },
      async write(next, entry) {
        const d = read();
        d.state = next;
        d.history = [entry, ...d.history].slice(0, 30);
        LS.set(key, JSON.stringify(d));
        emit();
      },
    };
  }

  const v = "10.12.2";
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const db = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
  const app = initializeApp(firebaseConfig);
  const database = db.getDatabase(app);
  const base = `homes/${code}`;
  const stateRef = db.ref(database, `${base}/state`);
  const histQuery = db.query(db.ref(database, `${base}/history`), db.orderByChild("at"), db.limitToLast(30));

  return {
    subscribe(fn) {
      let cur = { state: EMPTY, history: [] };
      const onErr = (err) => showError(err.code === "PERMISSION_DENIED" ? "קוד משפחה שגוי" : err.message);
      db.onValue(stateRef, (s) => { cur = { ...cur, state: s.val() || EMPTY }; fn(cur); }, onErr);
      db.onValue(histQuery, (s) => {
        const list = [];
        s.forEach((c) => { list.unshift(c.val()); });
        cur = { ...cur, history: list };
        fn(cur);
      }, onErr);
    },
    async write(next, entry) {
      await db.set(stateRef, next);
      await db.push(db.ref(database, `${base}/history`), entry);
    },
  };
}

// ---------- עזרים ----------
function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = !msg;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ago(ts) {
  if (!ts) return "";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return min === 1 ? "לפני דקה" : `לפני ${min} דק'`;
  const d = new Date(ts);
  const t = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (new Date().toDateString() === d.toDateString()) return `היום ${t}`;
  const y = new Date(Date.now() - 864e5);
  if (y.toDateString() === d.toDateString()) return `אתמול ${t}`;
  return `${d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} ${t}`;
}

// רכב במבט מלמעלה (חזית למעלה)
function carSvg(color) {
  return `<svg class="car" viewBox="0 0 60 112" aria-hidden="true">
    <rect x="1" y="34" width="6" height="10" rx="2" fill="${color}"/>
    <rect x="53" y="34" width="6" height="10" rx="2" fill="${color}"/>
    <rect x="5" y="3" width="50" height="106" rx="17" fill="${color}"/>
    <rect x="5" y="3" width="50" height="106" rx="17" fill="url(#shade)"/>
    <path d="M11 37 Q30 28 49 37 L46 52 L14 52 Z" fill="#0f172a" opacity=".78"/>
    <rect x="15" y="55" width="30" height="26" rx="6" fill="#000" opacity=".12"/>
    <path d="M14 84 L46 84 L48 96 Q30 101 12 96 Z" fill="#0f172a" opacity=".7"/>
    <ellipse cx="15" cy="8" rx="6" ry="2.4" fill="#fff" opacity=".95"/>
    <ellipse cx="45" cy="8" rx="6" ry="2.4" fill="#fff" opacity=".95"/>
    <rect x="11" y="105" width="10" height="2.5" rx="1" fill="#ef4444"/>
    <rect x="39" y="105" width="10" height="2.5" rx="1" fill="#ef4444"/>
    <defs><linearGradient id="shade" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </linearGradient></defs>
  </svg>`;
}
const miniCar = (color) =>
  `<svg viewBox="0 0 60 112"><rect x="5" y="3" width="50" height="106" rx="17" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M11 37 Q30 28 49 37 L46 52 L14 52 Z" fill="#0f172a" opacity=".7"/></svg>`;

// ---------- דיאלוג ----------
function ask({ title, text = "", input = false, placeholder = "", ok = "אישור" }) {
  const dlg = $("dlg");
  $("dlgTitle").textContent = title;
  $("dlgText").textContent = text;
  $("dlgText").hidden = !text;
  const inp = $("dlgInput");
  inp.hidden = !input;
  inp.value = "";
  inp.placeholder = placeholder;
  $("dlgOk").textContent = ok;
  dlg.returnValue = "";
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok" ? (input ? inp.value.trim() : true) : null), { once: true });
    dlg.showModal();
    if (input) inp.focus();
  });
}

// ---------- מסך כניסה ----------
function renderSetup() {
  document.body.dataset.status = "free";
  $("setup").hidden = false;
  $("main").hidden = true;
  $("whoBtn").hidden = true;
  $("codeInput").value = code || "";
  $("codeField").hidden = DEMO;
  const pick = $("peoplePick");
  pick.innerHTML = "";
  NAMES.forEach((name) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.innerHTML = `<span class="ico">${esc(initials(name))}</span><span class="txt"><b>${esc(name)}</b></span>`;
    b.onclick = () => {
      const c = DEMO ? "demo" : $("codeInput").value.trim();
      if (!c) return showError("צריך להכניס קוד משפחה");
      if (!/^[\w-]+$/.test(c)) return showError("הקוד יכול להכיל רק אותיות באנגלית, מספרים, - ו-_");
      me = name; code = c;
      LS.set("me", me); LS.set("code", code);
      showError("");
      start();
    };
    pick.appendChild(b);
  });
}

// ---------- מסך ראשי ----------
function slotHtml(tag, car, by, at, verb) {
  return `<span class="tag">${tag}</span>${carSvg(carColor(car))}
    <div class="info"><b>${esc(car || by)}</b><span>${esc(by)} ${verb} · ${ago(at)}</span></div>`;
}

function render(data) {
  lastData = data;
  const { state: s, history } = data;
  state = { ...EMPTY, ...s };
  const { parkedBy, parkedCar, parkedAt, blockedBy, blockedCar, blockedAt, note, updatedBy, updatedAt } = state;

  const status = !parkedBy ? "free" : blockedBy ? "blocked" : "parked";
  document.body.dataset.status = status;
  $("pillText").textContent = { free: "פנוי", parked: "תפוס", blocked: "חסום" }[status];
  $("headline").textContent =
    status === "free" ? "החניון פנוי" :
    status === "parked" ? `${parkedCar || parkedBy} בחניון` :
    `${parkedCar || parkedBy} חסום`;
  $("updated").textContent = updatedAt ? `${updatedBy} · ${ago(updatedAt)}` : "";
  $("noteView").hidden = !note;
  $("noteView").textContent = note ? `📝 ${note}` : "";

  // אנימציית "כניסה" רק כשרכב חדש נכנס, לא בכל רענון
  const fill = (el, key, cls, html) => {
    const same = el.dataset.key === key;
    el.dataset.key = key;
    el.className = cls;
    el.innerHTML = html;
    if (same) el.querySelector(".car")?.style.setProperty("animation", "none");
  };
  if (parkedBy) {
    fill($("slotIn"), `${parkedCar}|${parkedAt}`, "slot filled",
      slotHtml("בפנים", parkedCar, parkedBy, parkedAt, g(parkedBy, "חנה", "חנתה")));
  } else {
    fill($("slotIn"), "", "slot empty", `<span class="tag">בפנים</span>מקום פנוי`);
  }
  if (blockedBy) {
    fill($("slotOut"), `${blockedCar}|${blockedAt}`, "slot filled blocking",
      slotHtml("חוסם", blockedCar, blockedBy, blockedAt, g(blockedBy, "חסם", "חסמה")));
  } else {
    fill($("slotOut"), "", "slot empty", `<span class="tag">מאחור</span>${parkedBy ? "אין חסימה" : "—"}`);
  }

  renderActions(status);

  const ol = $("historyList");
  ol.innerHTML = history?.length
    ? history.map((h) => `<li>${esc(h.text)}<time>${ago(h.at)}</time></li>`).join("")
    : `<li>אין עדיין פעולות</li>`;
}

function addBtn({ title, sub = "", icon, kind, solid = false, wide = false }, fn) {
  const b = document.createElement("button");
  b.className = `btn k-${kind}${solid ? " solid" : ""}${wide ? " wide" : ""}`;
  b.innerHTML = `<span class="ico">${icon}</span><span class="txt"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>`;
  b.onclick = async () => {
    b.disabled = true;
    try {
      const done = await fn();
      if (done !== false) $("noteInput").value = "";
      showError("");
    } catch (e) {
      showError("שגיאה בשמירה: " + e.message);
    } finally {
      b.disabled = false;
    }
  };
  $("actions").appendChild(b);
}

function act(patch, text) {
  const note = $("noteInput").value.trim();
  const next = { ...state, ...patch, note, updatedBy: me, updatedAt: Date.now() };
  return store.write(next, { text: note ? `${text} — ${note}` : text, by: me, at: Date.now() });
}

async function askOtherCar() {
  const name = await ask({ title: "איזה רכב?", text: "לא חובה — אפשר להשאיר ריק", input: true, placeholder: "למשל: הרכב של השכן" });
  return name === null ? null : name.slice(0, 30) || OTHER;
}

function renderActions(status) {
  $("actions").innerHTML = "";
  const { parkedBy, parkedCar, blockedCar } = state;
  const signed = `${me} ${g(me, "סימן", "סימנה")}:`;
  const now = Date.now;

  if (status === "free") {
    $("actionsTitle").textContent = "מי נכנס לחניון?";
    const park = (car) => act({ ...CLEAR, parkedBy: me, parkedCar: car, parkedAt: now() }, `${signed} ${the(car)} בחניון`);
    CARS.forEach((c) => addBtn({ title: c.name, sub: "נכנס לחניון", icon: miniCar(c.color), kind: "parked" }, () => park(c.name)));
    addBtn({ title: OTHER, sub: "אורח / שכן", icon: miniCar(OTHER_COLOR), kind: "parked", wide: true }, async () => {
      const car = await askOtherCar();
      return car ? park(car) : false;
    });
  } else if (status === "parked") {
    $("actionsTitle").textContent = "מה קרה?";
    addBtn({ title: `${parkedCar || "הרכב"} יצא`, sub: "החניון יתפנה", icon: "✓", kind: "free", solid: true, wide: true }, () =>
      act(CLEAR, `${signed} ${the(parkedCar)} יצא, החניון פנוי`));
    const block = (car) => act({ blockedBy: me, blockedCar: car, blockedAt: now() }, `${signed} ${the(car)} חוסם את ${the(parkedCar)}`);
    CARS.filter((c) => c.name !== parkedCar).forEach((c) =>
      addBtn({ title: `${c.name} חוסם`, sub: "חנה מאחור", icon: miniCar(c.color), kind: "blocked" }, () => block(c.name)));
    addBtn({ title: `${OTHER} חוסם`, sub: "אורח / שכן", icon: miniCar(OTHER_COLOR), kind: "blocked" }, async () => {
      const car = await askOtherCar();
      return car ? block(car) : false;
    });
  } else {
    $("actionsTitle").textContent = "מה קרה?";
    addBtn({ title: `${blockedCar || "הרכב"} זז`, sub: "אין יותר חסימה", icon: "↩", kind: "free", solid: true, wide: true }, () =>
      act(CLEAR_BLOCK, `${signed} ${the(blockedCar)} זז, אין חסימה`));
  }

  const reset = $("resetBtn");
  reset.hidden = !parkedBy;
  reset.onclick = async () => {
    const ok = await ask({ title: "לאפס את המצב?", text: "החניון יסומן כפנוי, בלי רכבים.", ok: "איפוס" });
    if (ok) act(CLEAR, `${me} ${g(me, "איפס", "איפסה")} את המצב`).catch((e) => showError(e.message));
  };
}

// ---------- התחלה ----------
async function start() {
  if (!me || !code || !NAMES.includes(me)) return renderSetup();
  $("setup").hidden = true;
  $("main").hidden = false;
  const who = $("whoBtn");
  who.hidden = false;
  who.innerHTML = `<span class="avatar">${esc(initials(me))}</span>${esc(me)}${DEMO ? " · הדגמה" : ""}`;
  who.onclick = async () => {
    if (await ask({ title: "להחליף משתמש?", text: `כרגע מחובר/ת בתור ${me}.`, ok: "החלפה" })) {
      LS.del("me"); me = null; location.reload();
    }
  };
  try {
    store = await createStore(code);
    store.subscribe(render);
  } catch (e) {
    showError("לא הצלחתי להתחבר: " + e.message);
  }
}

// רענון "לפני X דק'" כל חצי דקה
setInterval(() => lastData && render(lastData), 30000);

start();
