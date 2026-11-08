// הגדרות האפליקציה — ערוך את הקובץ הזה.

// מי משתמש באפליקציה (אפשר לשנות/להוסיף). female: true — לניסוח בלשון נקבה
export const PEOPLE = [
  { name: "אבירן" },
  { name: "יורם מיכאל" },
  { name: "אמא", female: true },
];

// הגדרות Firebase — מעתיקים מ-Firebase Console:
// Project settings → General → Your apps → Web app → SDK setup and configuration
// (המפתחות האלה לא סודיים; ההגנה היא דרך "קוד משפחה" וחוקי ה-Database, ראה README)
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  databaseURL: "https://REPLACE_ME-default-rtdb.firebaseio.com",
  projectId: "REPLACE_ME",
  appId: "REPLACE_ME",
};
