# Grocery List

A small shared grocery and freezer list for one household. It runs in the browser, can be added to a phone's home screen like an app, and updates live on every device that has it open.

The interface is in Dutch. The code and this README are in English.

## Features

- **Boodschappen (groceries):** add items, check them off, remove them.
- **Vriezer (freezer):** add items with an optional "best before" date. Tap an item to see when it went in and when it expires. Items are sorted by soonest expiry and marked "Verlopen" once past the date.
- **Live sync:** changes on one phone appear on the other within a moment.
- **Sign-in:** Google sign-in. Only one specific Google account is allowed (enforced by the database security rules, not by the app).
- **Installable:** has a web app manifest, so it can be added to the home screen on Android.

## How it works

No build step and no npm: the browser loads the files directly.

| Part | Choice |
|------|--------|
| Hosting | GitHub Pages |
| Data and sign-in | Firebase (Firestore + Authentication), free Spark plan |
| Code | Plain HTML, CSS and JavaScript (ES modules), Firebase loaded from Google's CDN |

### Files

```
index.html          page skeleton: screens, popups, links to css and js
css/style.css       all styling (colors are variables at the top)
js/main.js          navigation, popup behavior, connects sign-in to the lists
js/firebase.js      Firebase config and the Firebase functions used elsewhere
js/auth.js          Google sign-in and sign-out, settings popup
js/groceries.js     the grocery list
js/freezer.js       the freezer list and its detail popup
manifest.webmanifest, icon-192.png, icon-512.png    home-screen install
```

### Data

Two Firestore collections:

- `groceryItems`: `text`, `done`, `createdAt`
- `freezerItems`: `text`, `addedAt`, `expiresOn` (`"YYYY-MM-DD"` or `null`)

## About the Firebase config

`js/firebase.js` contains a Firebase web config including an API key. This is meant to be public: it identifies the project, it is not a password. Access is protected by Google sign-in plus the Firestore security rules, and the API key is restricted to this site's address in the Google Cloud console. Never commit service account files, Admin SDK keys or database secrets.

## Setting up your own copy

1. Create a Firebase project (Spark plan; do not link a billing account) and add a web app to get your own config. Replace `firebaseConfig` in `js/firebase.js`.
2. Enable Google as a sign-in method (Authentication) and add your hosting domain under authorized domains.
3. Create a Firestore database and publish rules like this, with your own account's address:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isHousehold() {
         return request.auth != null
           && request.auth.token.email == "you@example.com"
           && request.auth.token.email_verified == true;
       }
       match /groceryItems/{itemId} { allow read, write: if isHousehold(); }
       match /freezerItems/{itemId} { allow read, write: if isHousehold(); }
     }
   }
   ```

4. Turn on GitHub Pages for the repository (Settings > Pages, deploy from the main branch).
5. Optionally restrict the API key to your site's address (Google Cloud console > APIs & Services > Credentials).

## Working on it

- The module files do not load when `index.html` is opened by double-clicking it; use a small local server or test on the hosted site.
- A local server address is refused by Firebase unless it is added to the API key's allowed referrers.
- GitHub Pages can take a minute to update after a change, and phones may briefly show a cached older version.
