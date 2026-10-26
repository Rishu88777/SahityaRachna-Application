# Sahitya Rachna – Android/iOS app

A lightweight React Native (Expo) wrapper that opens https://sahityarachana.org in a WebView and feels like a native app.

## Features
- Animated splash screen (native splash → branded animated overlay → fades out when the site is ready)
- Launcher icon (adaptive + monochrome) generated from the Sahitya Rachna logo
- Offline detection with a friendly screen; auto-reloads when the connection returns
- Error handling: no connection, slow load (30 s timeout), server errors (5xx), WebView crash recovery
- Thin top progress bar, pull-to-refresh, Android back button navigates web history (press twice to exit)
- External links (`tel:`, `mailto:`, WhatsApp, UPI, other websites) open in the right app instead of inside the WebView
- Small APK: R8 + resource shrinking, only `arm64-v8a` and `armeabi-v7a` ABIs, no extra UI libraries

## Run locally
```bash
npm install
npx expo start          # scan the QR with Expo Go, or press "a" for an emulator
```

## Build an installable APK
```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview      # produces a downloadable .apk
eas build -p android --profile production   # produces an .aab for Play Store
```

## Customise
- Site URL, colours, splash duration, load timeout: `src/config.js`
- App name, package id, version: `app.json`
- Icons / splash artwork: `assets/`

## Build the APK without a local machine
GitHub → **Actions** → **Build Android APK** → **Run workflow** (pick the branch). When it finishes (~10 min),
open the run and download the `sahitya-rachna-apk` artifact, unzip it and install the `.apk` on your phone.
The APK is signed with the default debug key, which is fine for testing; use `eas build --profile production` for Play Store.
