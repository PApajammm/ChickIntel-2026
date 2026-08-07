# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## 🚀 One-Click Setup (For Classmates on Windows)

If you downloaded this project as a ZIP from GitHub:
1. Extract/unzip the folder.
2. Double-click **`setup-and-run.bat`** (or **`setup.bat`**).
3. The script will automatically:
   - Check if Node.js is installed
   - Create your `.env` file automatically from `.env.example`
   - Run `npm install` to set up Expo and dependencies
   - Launch `npx expo start` for you!

---

## Manual Setup

1. Install dependencies


   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Debugging & Logs

This app uses `utils/logger.ts` to write lightweight structured logs.

- Call `logStep("some message", { optional: "context" })` in screens/components.
- Call `logError("some step failed", error, { optional: "context" })` for failures.
- Logs are emitted to the JS console and also appended to a JSONL file in the app document directory:
  - `ChickInteLLogs/chickintel-logs.jsonl`

When backend integration starts, we’ll keep KPI fetching isolated behind a single fetch function so it’s easy to swap the mock `0` values with real DB data while retaining logging.

## ChickIntel UI (home / tabs)

- **Brand palette:** `constants/chickintel-palette.ts` (greens + neutrals hex values used on the home screen, logout modal, and custom tab bar).
- **Home background:** `app/(tabs)/index.tsx` uses `assets_imported/background-gradient.svg` as a full-screen responsive layer behind content.
- **Status bar:** Shown via `expo-status-bar` in `app/_layout.tsx` (`style="dark"`) so time / network / battery remain visible.
- **Android system navigation bar:** Hidden with `expo-navigation-bar` in `app/(tabs)/_layout.tsx` while the tab navigator is mounted; replaced by the in-app bar in `components/chick-tab-bar.tsx` (**Back** → `router.back()`, **Home** → tab `index`, **Logout** → confirmation modal + `router.replace('/loginscreen')`).
- **Logout modal:** `components/logout-modal.tsx` — Cancel / Ok, themed with the ChickIntel palette.

## Demo Featured Breed Cards (Runtime Only)

- Home featured cards now use `utils/recent-breed-scans.ts`.
- Breed scans add recent cards from `app/(tabs)/scanner.tsx` and write logs with:
  - `Breed scan added to in-memory featured cards`
- Retention window: recent scans from the last 3 days only.
- Default fallback cards are always present to avoid blank UI:
  - `Barred Rock`, `Silkie`, `Rhode Island Red`
- This is demo-only runtime memory and clears on app restart.
- Backend handoff: replace this with database-backed storage plus dedupe guards on scan identifiers to prevent duplicate records.
