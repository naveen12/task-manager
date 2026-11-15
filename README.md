# Kairo

**Kairo** is a unified daily productivity workspace combining a collapsible **Calendar**, **Tasks**, **Smart Reminders**, **Alarms**, **Notes**, **Cloud/Local Backup**, and **Native Android Lock-Screen Alerts** in a responsive React + TypeScript + Capacitor application.

---

## Features

- **Dashboard & Collapsible Calendar**
  - Quick `+` floating/header action menu to jump directly into creating a **Task**, **Reminder**, **Alarm**, or **Note**.
  - Top collapsible monthly **Calendar** (hidden by default with a show/hide toggle) showing indicators on days with scheduled items and displaying a **Selected Day Details** breakdown.
- **Tasks**
  - Priority levels (**Low**, **Medium**, **High**), target date, optional due time, tactile completion toggles, and automatic alert scheduling.
- **Reminders**
  - Priority levels (**Low**, **Medium**, **High**) and flexible recurrence: **Once**, **Daily**, **Weekdays**, **Monthly**, and **Yearly**.
- **Alarms & Device Ringtones**
  - Interactive **Temporal Wheel** time picker and **New Alarm** view.
  - Built-in synthesized alarm chimes (`soundEngine.ts`) plus **OS / Device Ringtone** picker (`ringtoneStore.ts`) persisted offline in IndexedDB.
- **Notes**
  - Lightweight daily notes organized alongside your schedule.
- **Notifications & Lock-Screen Alerts (Web + Android)**
  - Unified alert queue for **Alarms**, **Reminders**, and **Tasks** with balanced side-by-side **Snooze 5m** and **Stop** controls.
  - **Web**: Browser Notification API + Service Worker (`public/sw.js`) + interactive full-screen overlay (`AlarmRingOverlay.tsx`).
  - **Native Android (Capacitor)**:
    - Exact scheduling via `AlarmManager.setAlarmClock` (`AlarmScheduler.java`) and reboot recovery (`BootReceiver.java`).
    - Wakes CPU with `WakeLock` (`ExactAlarmReceiver.java`) and launches a media-playback `ForegroundService` (`AlarmForegroundService.java`) playing `USAGE_ALARM` audio + vibration.
    - Displays **Heads-Up**, **High-Priority**, and **Lock-Screen (`VISIBILITY_PUBLIC`)** notifications with **Snooze 5m** & **Stop** actions.
    - Launches a dedicated native lock-screen popup (`AlarmLockScreenActivity.java`) using `setShowWhenLocked(true)`, `setTurnScreenOn(true)`, and `USE_FULL_SCREEN_INTENT` / `SYSTEM_ALERT_WINDOW`.
- **Customization & Backup**
  - **Settings**: Light & Dark themes, selectable app font families (`DM Sans`, `Outfit`, `Manrope`, `Plus Jakarta Sans`, `Lora`, `JetBrains Mono`), adjustable font size scale, and a live **Android Lock-Screen & Background Alert Permissions** checklist.
  - **Backup & Restore**: Export/import local JSON backups or sync with Google Drive (`BackupSection.tsx`).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React
- **Storage**: `localStorage` + IndexedDB (for custom device ringtones)
- **Mobile Wrapper**: Capacitor (`android-native/` Java plugin, service, receivers, and lock-screen activity)

---

## Project Structure

```text
├── android-native/java/          # Native Android Java templates injected by android:setup
│   ├── AlarmForegroundService.java
│   ├── AlarmLockScreenActivity.java
│   ├── AlarmScheduler.java
│   ├── BootReceiver.java
│   ├── ExactAlarmReceiver.java
│   ├── KairoAlarmPlugin.java
│   └── MainActivity.java
├── public/
│   ├── favicon.svg               # Kairo app icon
│   └── sw.js                     # Service Worker for web notifications
├── scripts/
│   └── apply-android-native.mjs  # Copies Java files & patches AndroidManifest.xml
├── src/
│   ├── components/               # UI sections, TemporalWheel, AlarmRingOverlay, toggles
│   ├── types/chrono.ts           # Core data models & date/time helpers
│   ├── utils/                    # Sound, ringtone store, notifications, Drive & Android bridge
│   ├── App.tsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.ts
```

---

## Getting Started (Web)

### Prerequisites
- **Node.js** 18+ (or 20+ recommended)

### Install & Run Locally
```bash
npm install
npm run dev
```

### Type-Check & Production Build
```bash
npm run lint
npm run build
```

---

## Building the Android APK (Capacitor)

### Prerequisites
- **Android Studio** + Android SDK (API 33–35)
- **JDK 17+**

### 1. Build Web Bundle & Initialize Android (First Time Only)
```bash
npm install
npm run build
npx cap init "Kairo" "com.kairo.app" --web-dir=dist
npx cap add android
```

> If `android/` already exists in your local workspace, skip `npx cap init` and `npx cap add android`.

### 2. Apply Native Lock-Screen Alert Code & Sync
```bash
npm run build
npm run android:setup
npx cap sync android
```

`npm run android:setup` automatically detects your Android package ID, copies the Java classes into `android/app/src/main/java/<package>/`, and adds required entries to `AndroidManifest.xml`, including:
- `POST_NOTIFICATIONS`
- `SCHEDULE_EXACT_ALARM` & `USE_EXACT_ALARM`
- `USE_FULL_SCREEN_INTENT`
- `WAKE_LOCK`
- `SYSTEM_ALERT_WINDOW`
- `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

### 3. Build the Debug APK

**Windows (PowerShell / CMD):**
```powershell
cd android
.\gradlew.bat assembleDebug
```

**macOS / Linux:**
```bash
cd android
./gradlew assembleDebug
```

Output APK path:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Grant Device Permissions After Installing
Open **Kairo → Settings → Notifications & Alert Popups** on your Android device and tap **Enable** on each listed permission:
1. **Heads-Up, Lock Screen & High-Priority Notifications**
2. **Full-Screen Lock Popup**
3. **Overlay / Draw Over Other Apps**
4. **Exact Alarm Scheduling**
5. **Unrestricted Background Battery**
