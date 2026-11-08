// הגדרות האפליקציה — ערוך את הקובץ הזה.

// מי משתמש באפליקציה (אפשר לשנות/להוסיף). female: true — לניסוח בלשון נקבה
export const PEOPLE = [
  { name: "אמא", female: true },
  { name: "אבירן" },
  { name: "יורם מיכאל" },
];

// הרכבים (אפשר לשנות/להוסיף)
//   model — צורת הציור: "suv" או "sedan"
//   color — צבע הרכב בציור
//   photo — (לא חובה) תמונה אמיתית של הרכב, למשל "cars/xpeng.jpg". אם יש — מוצגת במקום הציור
export const CARS = [
  { name: "אקספנג", model: "suv", color: "#17191e", photo: "" },   // Xpeng G6 שחורה
  { name: "לקסוס", model: "sedan", color: "#17191e", photo: "" },  // Lexus 300h שחורה
];

// הגדרות Firebase — מעתיקים מ-Firebase Console:
// Project settings → General → Your apps → Web app → SDK setup and configuration
// (המפתחות האלה לא סודיים; ההגנה היא דרך "קוד משפחה" וחוקי ה-Database, ראה README)
export const firebaseConfig = {
  apiKey: "AIzaSyB9je9bXZk2oDD9EiMDTs0H7mUz2oVLPYc",
  authDomain: "deganya6-pariking.firebaseapp.com",
  databaseURL: "https://deganya6-pariking-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "deganya6-pariking",
  storageBucket: "deganya6-pariking.firebasestorage.app",
  messagingSenderId: "149055501151",
  appId: "1:149055501151:web:e85760c9e35fd8c0d87cea",
};
