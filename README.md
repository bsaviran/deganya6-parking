# 🅿️ חניה דגניה 6

אפליקציית web קטנה לעדכון בזמן אמת מי חונה בחניון, האם הוא פנוי, ומי חוסם את מי שחונה.

- **חניתי בחניון** — מסמן שאתה בפנים
- **חסמתי את …** — מסמן שחנית מאחורי מי שבפנים
- **הזזתי — שחררתי חסימה** / **יצאתי — החניון פנוי**
- הערה חופשית ("יוצא ב-8:00"), היסטוריה של 30 הפעולות האחרונות
- עובד מהטלפון, אפשר "להוסיף למסך הבית" כמו אפליקציה

האתר סטטי (HTML/JS בלבד) ומתארח בחינם ב-GitHub Pages. הסנכרון בין הטלפונים נעשה דרך Firebase Realtime Database (חינמי).

## הרצה מקומית (מצב הדגמה)

כל עוד `config.js` לא הוגדר, האפליקציה רצה ב"מצב הדגמה" ושומרת רק בדפדפן שלך:

```bash
python3 -m http.server 8000
# ואז לפתוח http://localhost:8000
```

## הגדרה (פעם אחת, ~10 דקות)

### 1. Firebase
1. נכנסים ל-https://console.firebase.google.com → **Add project** (אפשר לכבות Analytics).
2. בתפריט: **Build → Realtime Database → Create database** → בוחרים מיקום (למשל `europe-west1`) → **Start in locked mode**.
3. בלשונית **Rules** מדביקים את התוכן של `database.rules.example.json`,
   ומחליפים את `CHANGE_TO_YOUR_FAMILY_CODE` בקוד סודי משלכם (אותיות באנגלית/מספרים, למשל `dganya6-k93xq`) → **Publish**.
   > את הקוד הזה **לא** שומרים בגיט — רק ב-Firebase ובראש שלכם.
4. **Project settings (⚙️) → General → Your apps → `</>` (Web)** → נותנים שם → מעתיקים את ה-`firebaseConfig` לתוך `config.js`.
5. ב-`config.js` אפשר לערוך את `PEOPLE` (שמות, ו-`female: true` לניסוח בלשון נקבה).

### 2. GitHub
```bash
git remote add origin https://github.com/<USER>/deganya6-parking.git
git push -u origin main
```
ואז ב-GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root** → Save.
אחרי דקה האתר יהיה זמין ב-`https://<USER>.github.io/deganya6-parking/`.

### 3. בטלפון
פותחים את הקישור, מכניסים את קוד המשפחה ובוחרים מי אתה. באייפון: שיתוף → **הוסף למסך הבית**.

## אבטחה
מפתחות ה-Firebase שב-`config.js` אינם סודיים (הם תמיד גלויים בדפדפן). מה שמגן על המידע הוא חוקי ה-Database: אפשר לקרוא/לכתוב רק תחת `homes/<קוד המשפחה>`, ומי שלא יודע את הקוד לא יכול לגשת.

## קבצים
| קובץ | תפקיד |
|---|---|
| `index.html` | מבנה הדף |
| `style.css` | עיצוב (כולל מצב כהה) |
| `app.js` | לוגיקה + חיבור ל-Firebase |
| `config.js` | שמות + הגדרות Firebase |
| `database.rules.example.json` | חוקי אבטחה להדבקה ב-Firebase |
