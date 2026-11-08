import { PEOPLE, CARS, firebaseConfig } from "./config.js";

const NAMES = PEOPLE.map((p) => p.name);
const OTHER = "רכב אחר";
// ניסוח לפי מגדר: g(name, "חנה", "חנתה")
const g = (name, m, f) => (PEOPLE.find((p) => p.name === name)?.female ? f : m);

const $ = (id) => document.getElementById(id);
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const DEMO = firebaseConfig.apiKey === "REPLACE_ME";
const EMPTY = { parkedBy: null, parkedAt: null, blockedBy: null, blockedAt: null, note: "" };

let me = LS.get("me");
let code = LS.get("code");
let state = { ...EMPTY };
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

// ---------- UI ----------
function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = !msg;
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return today ? `היום ${t}` : `${d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} ${t}`;
}

function renderSetup() {
  $("setup").hidden = false;
  $("main").hidden = true;
  $("whoBtn").hidden = true;
  $("codeInput").value = code || "";
  if (DEMO) $("codeInput").closest("label").hidden = true;
  const pick = $("peoplePick");
  pick.innerHTML = "";
  NAMES.forEach((name) => {
    const b = document.createElement("button");
    b.textContent = name;
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

function render({ state: s, history }) {
  state = { ...EMPTY, ...s };
  const card = $("statusCard");
  card.className = "card status";
  let emoji, text, sub = "";

  const s_ = state;
  const parkedLabel = s_.parkedCar || s_.parkedBy;
  const blockedLabel = s_.blockedCar || s_.blockedBy;
  const parkedLine = `🚗 ${parkedLabel} — ${s_.parkedBy} ${g(s_.parkedBy, "חנה", "חנתה")} ${fmtTime(s_.parkedAt)}`;

  if (!s_.parkedBy) {
    card.classList.add("free");
    emoji = "✅"; text = "החניון פנוי";
  } else if (s_.blockedBy) {
    card.classList.add("blocked");
    emoji = "⛔";
    text = `${parkedLabel} בחניון\n${blockedLabel} חוסם`;
    sub = `${parkedLine}\n⛔ ${blockedLabel} — ${s_.blockedBy} ${g(s_.blockedBy, "חסם", "חסמה")} ${fmtTime(s_.blockedAt)}`;
  } else {
    card.classList.add("parked");
    emoji = "🚗"; text = `${parkedLabel} בחניון`;
    sub = parkedLine;
  }
  if (state.note) sub += (sub ? "\n" : "") + `📝 ${state.note}`;

  $("statusEmoji").textContent = emoji;
  $("statusText").textContent = text;
  $("statusSub").textContent = sub;

  renderActions();

  const ul = $("historyList");
  ul.innerHTML = "";
  (history || []).forEach((h) => {
    const li = document.createElement("li");
    li.textContent = h.text;
    const t = document.createElement("time");
    t.textContent = fmtTime(h.at);
    li.appendChild(t);
    ul.appendChild(li);
  });
  if (!history?.length) ul.innerHTML = "<li>אין עדיין פעולות</li>";
}

function addBtn(label, cls, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = async () => {
    b.disabled = true;
    try { await fn(); $("noteInput").value = ""; showError(""); }
    catch (e) { showError("שגיאה בשמירה: " + e.message); }
    finally { b.disabled = false; }
  };
  $("actions").appendChild(b);
}

function act(patch, text) {
  const note = $("noteInput").value.trim();
  const next = { ...state, ...patch, note, updatedBy: me, updatedAt: Date.now() };
  return store.write(next, { text: note ? `${text} — ${note}` : text, by: me, at: Date.now() });
}

function renderActions() {
  $("actions").innerHTML = "";
  const now = () => Date.now();
  const { parkedBy, parkedCar, blockedBy, blockedCar } = state;
  const CLEAR = { parkedBy: null, parkedCar: null, parkedAt: null, blockedBy: null, blockedCar: null, blockedAt: null };
  const CLEAR_BLOCK = { blockedBy: null, blockedCar: null, blockedAt: null };

  // "האקספנג" אבל "רכב של השכן" (בלי ה' כפולה לשם חופשי)
  const the = (car) => (CARS.includes(car) ? `ה${car}` : car || "הרכב");
  // כפתור "רכב אחר": שואל איזה רכב (לא חובה) ואז מבצע
  const other = (label, cls, run) =>
    addBtn(label, cls, () => {
      const name = prompt("איזה רכב? (למשל: הרכב של השכן) — אפשר להשאיר ריק");
      if (name === null) return Promise.resolve(); // ביטול
      return run(name.trim().slice(0, 30) || OTHER);
    });

  if (!parkedBy) {
    const park = (car) => act({ ...CLEAR, parkedBy: me, parkedCar: car, parkedAt: now() },
      `${me} ${g(me, "סימן", "סימנה")}: ${the(car)} בחניון`);
    CARS.forEach((car) => addBtn(`🚗 ${the(car)} בחניון`, "parked", () => park(car)));
    other(`🚙 ${OTHER} בחניון`, "parked ghost-color", park);
  } else if (!blockedBy) {
    const block = (car) => act({ blockedBy: me, blockedCar: car, blockedAt: now() },
      `${me} ${g(me, "סימן", "סימנה")}: ${the(car)} חוסם את ${the(parkedCar)}`);
    CARS.filter((c) => c !== parkedCar).forEach((car) =>
      addBtn(`⛔ ${the(car)} חוסם`, "blocked", () => block(car)));
    other(`⛔ ${OTHER} חוסם`, "blocked ghost-color", block);
    addBtn(`✅ ${the(parkedCar)} יצא — החניון פנוי`, "free", () =>
      act(CLEAR, `${me} ${g(me, "סימן", "סימנה")}: ${the(parkedCar)} יצא, החניון פנוי`));
  } else {
    addBtn(`↩️ ${the(blockedCar)} זז — אין חסימה`, "free", () =>
      act(CLEAR_BLOCK, `${me} ${g(me, "סימן", "סימנה")}: ${the(blockedCar)} זז, אין חסימה`));
  }

  // תיקון ידני אם המצב לא נכון
  if (parkedBy) {
    addBtn("🧹 איפוס — החניון פנוי", "ghost", () => {
      if (!confirm("לאפס את המצב לחניון פנוי?")) return Promise.resolve();
      return act(CLEAR, `${me} ${g(me, "איפס", "איפסה")} את המצב`);
    });
  }
}

async function start() {
  if (!me || !code || !NAMES.includes(me)) return renderSetup();
  $("setup").hidden = true;
  $("main").hidden = false;
  const who = $("whoBtn");
  who.hidden = false;
  who.textContent = `👤 ${me}${DEMO ? " · הדגמה" : ""}`;
  who.onclick = () => { LS.del("me"); me = null; location.reload(); };
  try {
    store = await createStore(code);
    store.subscribe(render);
  } catch (e) {
    showError("לא הצלחתי להתחבר: " + e.message);
  }
}

start();
