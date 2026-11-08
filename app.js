import { PEOPLE, CARS, firebaseConfig } from "./config.js";

const NAMES = PEOPLE.map((p) => p.name);
const isAdmin = (name) => !!PEOPLE.find((p) => p.name === name)?.admin;
const CAR_NAMES = CARS.map((c) => c.name);
const OTHER = "רכב אחר";
const OTHER_COLOR = "#a3a3a3";
// ניסוח לפי מגדר: g(name, "חנה", "חנתה")
const g = (name, m, f) => (PEOPLE.find((p) => p.name === name)?.female ? f : m);
// "האקספנג" אבל "רכב של השכן" (בלי ה' כפולה לשם חופשי)
const the = (car) => (CAR_NAMES.includes(car) ? `ה${car}` : car || "הרכב");

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

let fbPromise = null;
function getFirebase() {
  fbPromise ||= (async () => {
    const v = "10.12.2";
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const db = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
    return { db, database: db.getDatabase(initializeApp(firebaseConfig)) };
  })();
  return fbPromise;
}
const isDenied = (e) => /permission/i.test(`${e?.code} ${e?.message}`);
const WRONG_CODE = "קוד שגוי — לא ניתן להיכנס";

// קוד שגוי: מוחקים אותו וחוזרים למסך הכניסה
function kickOut() {
  code = null;
  LS.del("code");
  renderSetup();
  showError(WRONG_CODE);
  $("codeInput").classList.add("bad");
  $("codeInput").focus();
}

// ---------- Store: Firebase (אמיתי) או localStorage (מצב הדגמה) ----------
async function createStore(code) {
  if (DEMO) {
    const key = "demo-state";
    const listeners = [];
    const read = () => JSON.parse(LS.get(key) || "null") || { state: EMPTY, history: [] };
    const emit = () => listeners.forEach((fn) => fn(read()));
    window.addEventListener("storage", (e) => e.key === key && emit());
    return {
      async check() {},
      subscribe(fn) { listeners.push(fn); fn(read()); },
      async write(next, entry) {
        const d = read();
        d.state = next;
        d.history = [entry, ...d.history].slice(0, 30);
        LS.set(key, JSON.stringify(d));
        emit();
      },
      async clearHistory() {
        const d = read();
        d.history = [];
        LS.set(key, JSON.stringify(d));
        emit();
      },
    };
  }

  const { db, database } = await getFirebase();
  const base = `homes/${code}`;
  const stateRef = db.ref(database, `${base}/state`);
  const histQuery = db.query(db.ref(database, `${base}/history`), db.orderByChild("at"), db.limitToLast(30));

  return {
    // בודק שהקוד נכון (Firebase דוחה קוד שגוי עם Permission denied)
    async check() { await db.get(stateRef); },
    subscribe(fn) {
      let cur = { state: EMPTY, history: [] };
      const onErr = (err) => (isDenied(err) ? kickOut() : showError(err.message));
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
    async clearHistory() {
      await db.remove(db.ref(database, `${base}/history`));
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

// ---------- ציורי רכבים (מבט מלמעלה, חזית למעלה) ----------
const carInfo = (car) => CARS.find((c) => c.name === car) || { model: "sedan", color: OTHER_COLOR };
let svgId = 0;

// חלקים לפי דגם: suv = אקספנג G6 (קופה-SUV, פס אור רציף, גג זכוכית), sedan = לקסוס (גריל ספינדל, פנסי חץ)
const MODELS = {
  suv: {
    body: { x: 4, y: 4, w: 52, h: 104, rx: 20 },
    mirrors: 33,
    parts: (glass) => `
      <rect x="9" y="8" width="42" height="2.2" rx="1.1" fill="#e0f2fe"/>
      <rect x="9" y="8" width="42" height="2.2" rx="1.1" fill="#7dd3fc" opacity=".6" filter="blur(1.5px)"/>
      <path d="M9 34 Q30 25 51 34 L48 48 L12 48 Z" fill="${glass}"/>
      <rect x="12" y="50" width="36" height="35" rx="8" fill="${glass}"/>
      <path d="M12 87 L48 87 L49 95 Q30 99 11 95 Z" fill="${glass}"/>
      <rect x="9" y="103" width="42" height="2.4" rx="1.2" fill="#ef4444"/>`,
  },
  sedan: {
    body: { x: 7, y: 2, w: 46, h: 108, rx: 16 },
    mirrors: 37,
    parts: (glass) => `
      <path d="M23 3.5 L37 3.5 L34 11 L26 11 Z" fill="#05070b" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>
      <path d="M10 10 L20 6 L20 8.4 L12.5 12 Z" fill="#f8fafc"/>
      <path d="M50 10 L40 6 L40 8.4 L47.5 12 Z" fill="#f8fafc"/>
      <path d="M12 38 Q30 30 48 38 L45 52 L15 52 Z" fill="${glass}"/>
      <rect x="20" y="57" width="20" height="15" rx="3" fill="${glass}"/>
      <path d="M15 80 L45 80 L47 90 Q30 94 13 90 Z" fill="${glass}"/>
      <rect x="10" y="105.5" width="40" height="2" rx="1" fill="#ef4444"/>`,
  },
};

function carSvg(car, cls = "car") {
  const { model, color, photo } = carInfo(car);
  if (photo) return `<img class="${cls} car-photo" src="${esc(photo)}" alt="${esc(car)}" />`;
  const m = MODELS[model] || MODELS.sedan;
  const id = `g${++svgId}`;
  const b = m.body;
  const glass = `url(#${id}glass)`;
  return `<svg class="${cls}" viewBox="0 0 60 112" aria-hidden="true">
    <defs>
      <linearGradient id="${id}shade" x1="0" x2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".05"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/>
      </linearGradient>
      <linearGradient id="${id}glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4b5a70"/><stop offset=".45" stop-color="#1e2633"/><stop offset=".55" stop-color="#2c3646"/><stop offset="1" stop-color="#11161f"/>
      </linearGradient>
    </defs>
    <rect x="${b.x - 3}" y="${m.mirrors}" width="5" height="9" rx="2" fill="${color}" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>
    <rect x="${b.x + b.w - 2}" y="${m.mirrors}" width="5" height="9" rx="2" fill="${color}" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.rx}" fill="${color}" stroke="rgba(255,255,255,.32)" stroke-width="1.2"/>
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.rx}" fill="url(#${id}shade)"/>
    ${m.parts(glass)}
  </svg>`;
}
const miniCar = (car) => carSvg(car, "mini");

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
  $("codeInput").classList.remove("bad");
  $("codeInput").oninput = () => { $("codeInput").classList.remove("bad"); showError(""); };
  $("codeField").hidden = DEMO;
  const pick = $("peoplePick");
  pick.innerHTML = "";
  NAMES.forEach((name) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.innerHTML = `<span class="ico">${esc(initials(name))}</span><span class="txt"><b>${esc(name)}</b></span>`;
    b.onclick = async () => {
      const c = DEMO ? "demo" : $("codeInput").value.trim();
      if (!c) return showError("צריך להכניס קוד משפחה");
      if (!/^[\w-]+$/.test(c)) return kickOut();
      me = name; code = c;
      showError("");
      pick.querySelectorAll("button").forEach((x) => (x.disabled = true));
      b.querySelector("small")?.remove();
      b.querySelector(".txt").insertAdjacentHTML("beforeend", "<small>בודק קוד…</small>");
      await start(true);
    };
    pick.appendChild(b);
  });
}

// ---------- מסך ראשי ----------
function slotHtml(tag, car, by, at, verb) {
  return `<span class="tag">${tag}</span>${carSvg(car)}
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
    fill($("slotIn"), `${parkedCar}|${parkedAt}`, "slot in filled",
      slotHtml("בפנים", parkedCar, parkedBy, parkedAt, g(parkedBy, "חנה", "חנתה")));
  } else {
    fill($("slotIn"), "", "slot in empty", `<span class="tag">בפנים</span>מקום פנוי`);
  }
  if (blockedBy) {
    fill($("slotOut"), `${blockedCar}|${blockedAt}`, "slot filled blocking",
      slotHtml("חוסם", blockedCar, blockedBy, blockedAt, g(blockedBy, "חסם", "חסמה")));
  } else {
    fill($("slotOut"), "", "slot empty", `<span class="tag">חוסם</span>${parkedBy ? "אין חסימה" : "—"}`);
  }

  renderActions(status);

  const ol = $("historyList");
  ol.innerHTML = history?.length
    ? history.map((h) => `<li>${esc(h.text)}<time>${ago(h.at)}</time></li>`).join("")
    : `<li>אין עדיין פעולות</li>`;
  $("clearHistBtn").hidden = !isAdmin(me) || !history?.length;
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
  const name = await ask({ title: "איזה רכב?", text: "לא חובה — אפשר להשאיר ריק", input: true, placeholder: "למשל: הרכב של דני" });
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
    CARS.forEach((c) => addBtn({ title: c.name, sub: "נכנס לחניון", icon: miniCar(c.name), kind: "parked" }, () => park(c.name)));
    addBtn({ title: OTHER, sub: "אורח", icon: miniCar(OTHER), kind: "parked", wide: true }, async () => {
      const car = await askOtherCar();
      return car ? park(car) : false;
    });
  } else if (status === "parked") {
    $("actionsTitle").textContent = "מה קרה?";
    addBtn({ title: `${parkedCar || "הרכב"} יצא`, sub: "החניון יתפנה", icon: "✓", kind: "free", solid: true, wide: true }, () =>
      act(CLEAR, `${signed} ${the(parkedCar)} יצא, החניון פנוי`));
    const block = (car) => act({ blockedBy: me, blockedCar: car, blockedAt: now() }, `${signed} ${the(car)} חוסם את ${the(parkedCar)}`);
    CARS.filter((c) => c.name !== parkedCar).forEach((c) =>
      addBtn({ title: `${c.name} חוסם`, sub: "חנה מאחור", icon: miniCar(c.name), kind: "blocked" }, () => block(c.name)));
    addBtn({ title: `${OTHER} חוסם`, sub: "אורח", icon: miniCar(OTHER), kind: "blocked" }, async () => {
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
async function start(fromSetup = false) {
  if (!me || !code || !NAMES.includes(me)) return renderSetup();
  $("loading").hidden = fromSetup;
  try {
    store = await createStore(code);
    await store.check();
  } catch (e) {
    $("loading").hidden = true;
    if (isDenied(e)) return kickOut();
    // בעיית רשת: מכניסה ראשונה — לא נכנסים; קוד ששמור כבר — נכנסים ומנסים להתחבר
    if (fromSetup) {
      renderSetup();
      return showError("אין חיבור לאינטרנט — נסו שוב");
    }
  }
  $("loading").hidden = true;
  LS.set("me", me);
  LS.set("code", code);
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
  if (!store) return showError("לא הצלחתי להתחבר — נסו לרענן");
  $("clearHistBtn").onclick = async () => {
    if (!isAdmin(me)) return;
    const ok = await ask({ title: "למחוק את כל ההיסטוריה?", text: "אי אפשר לשחזר. מצב החניה הנוכחי לא ישתנה.", ok: "מחיקה" });
    if (ok) store.clearHistory().catch((e) => showError("שגיאה במחיקה: " + e.message));
  };
  store.subscribe(render);
}

// רענון "לפני X דק'" כל חצי דקה
setInterval(() => lastData && render(lastData), 30000);

start();
