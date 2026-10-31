# Smart Study Planner — Plan Smart, Study Better

A React + Vite web app for students: daily and weekly planning, exam and assignment deadlines, a calendar, analytics built from real task data, and a study assistant. Users **sign in with their Google (Gmail) account**, and each account's data is stored separately.

## 1. Run it locally

You need Node.js 18 or newer.

```bash
npm install
cp .env.example .env      # then fill in the Firebase values (section 2)
npm run dev               # opens http://localhost:5173
```

Other commands:

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build
npm test          # logic tests (dates, validation, stats, recommendation engine, assistant)
```

Without a `.env` file the app still works in **guest mode** (data stays in that browser). The Google button shows a setup message until Firebase is configured.

## 2. Turn on Google sign-in and per-user storage (about 5 minutes, free)

Google sign-in needs a small cloud project, because only Google can verify who someone is. We use Firebase (free "Spark" plan is enough).

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** (choose a support email, Save).
3. **Build → Firestore Database → Create database** (production mode, any region).
4. In Firestore open the **Rules** tab, paste the contents of `firestore.rules` from this project, and **Publish**. This makes sure each user can read and write **only their own** document.
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy the config values into `.env`:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
6. **Authentication → Settings → Authorized domains**: `localhost` is there by default. When you deploy (for example to Firebase Hosting, Netlify or Vercel), add your website's domain here, and set the same `VITE_FIREBASE_*` values in the host's environment settings.
7. Restart `npm run dev`.

The Firebase web config values are public identifiers, not secrets. Your data is protected by the Firestore rules in step 4, so **do not skip that step**.

### How data is stored

- Signed-in users: one Firestore document `users/{uid}` holding their tasks, weekly goals and settings. A copy is also kept in the browser, so the app keeps working offline and the newer copy wins on the next load.
- Guests: browser `localStorage` only, under a separate key.
- A new account starts with clearly labelled demo data (a "Demo" badge and a banner). Users can remove it from the dashboard or Settings.
- Changes are saved automatically about half a second after the last edit. The top bar shows *Saving… / Synced / Not saved — retry*.

## 3. Project structure

```
src/
  main.jsx, App.jsx          entry point, hash routing, sign-in gate
  services/
    firebase.js              Firebase init (only if .env is filled in)
    auth.jsx                 Google sign-in, guest mode, sign-out
    storage.js               load/save per-user data (Firestore + local copy)
  state/store.jsx            central state: tasks, goals, settings + CRUD actions
  utils/                     pure logic, no React (unit tested)
    dates.js  validation.js  stats.js  recommend.js  assistant.js  sampleData.js  constants.js
  components/                Layout (sidebar/top bar), TaskForm, TaskItem, TaskEditor (add/edit dialog),
                             charts (Recharts), ui (toasts, confirm dialog, modal, badges...)
  pages/                     Login, Dashboard, DailyTasks, WeeklyPlan, AddTask, Exams,
                             CalendarPage, Analytics, Assistant, Settings
  styles.css                 design tokens, light/dark themes, responsive layout
tests/logic.test.mjs         `npm test`
firestore.rules              security rules to publish in Firebase
```

## 4. How the recommendation engine works

It is a transparent scoring rule, **not machine learning** (`src/utils/recommend.js`). Each pending task gets points:

| Factor | Points |
| --- | --- |
| Overdue | +45 |
| Due today / tomorrow | +35 / +30 |
| Due in 2–3 days / 4–7 days / later | +20 / +10 / +3 |
| Priority High / Medium / Low | +30 / +18 / +8 |
| Difficulty Hard / Medium / Easy | +6 / +3 / 0 |
| Exam | +5 |

Tasks are sorted by score, and the reasons (for example "Overdue · High priority") are shown to the student. To build a plan, the engine fills the time the student has, in score order. Study blocks plus breaks **never exceed the available time**; hard tasks use shorter sessions (75% of the preferred length); a break is inserted between sessions; a long task is split across sessions.

## 5. Study assistant: what it is and its limits

- It is a **local, rule-based demo assistant**, labelled as such in the interface. It is not an AI language model.
- It can: build a plan from your real tasks, rank what to do first, split an exam's syllabus topics into revision tasks, suggest a Pomodoro-style routine, and draft a task from a sentence (you must approve it before it is saved).
- Topic explanations come from a small built-in glossary (machine learning, databases, operating systems, data structures basics). For anything else it says so instead of guessing.
- Natural-language understanding is keyword matching, so unusual phrasing may not be recognised. Use the quick-action buttons.
- Task drafts parse simple phrases like "add task read OS chapter 4 tomorrow 45 min high". Dates other than today, tomorrow and "in N days" are not understood.

### Connecting a real AI later

Never put an AI provider key in this front-end code. Instead:

1. Create a small backend you control (for example a Firebase Cloud Function or an Express server) that holds the provider key as a server-side secret, receives `{ message, context }`, calls the AI model, and returns `{ "reply": "..." }`. Verify the user's Firebase ID token there to prevent abuse.
2. Put its URL in `.env` as `VITE_AI_PROXY_URL=https://your-backend.example.com/ask`.
3. The assistant (`askRemoteAI` in `src/utils/assistant.js`) then sends open-ended questions the glossary cannot answer to that URL, and labels those replies "AI service". If the call fails it falls back to the local answer.

## 6. Notes and limitations

- Analytics measure **task completion and estimated study time**, not grades or learning. Study time is the estimate typed when creating the task, not tracked time.
- Overdue, streaks and "this week" use the device's local date and time.
- The app uses a hash router (`/#/dashboard`), so it works on any static host without server configuration.
