// Sign-in, sign-out and the settings popup.
import {
  auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "./firebase.js";

const settingsDialog = document.getElementById("settings-dialog");
const authLoading = document.getElementById("auth-loading");
const loginScreen = document.getElementById("login-screen");
const appContainer = document.getElementById("app");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout-button");
const settingsButton = document.getElementById("settings-button");
const settingsEmail = document.getElementById("settings-email");

// main.js passes in what should happen after sign-in and sign-out
// (starting and stopping the lists), so this file knows nothing about them.
export function initAuth({ onSignedIn, onSignedOut }) {
  settingsButton.addEventListener("click", () => settingsDialog.showModal());

  loginButton.addEventListener("click", () => {
    loginError.textContent = "";
    const provider = new GoogleAuthProvider();
    // Always let the user pick an account (the browser may know several).
    provider.setCustomParameters({ prompt: "select_account" });
    // Must be called directly from the click, or phones may block the popup.
    signInWithPopup(auth, provider).catch((error) => {
      console.error(error);
      if (error.code === "auth/popup-closed-by-user" ||
          error.code === "auth/cancelled-popup-request") {
        return; // The user closed the window: not an error.
      }
      if (error.code === "auth/popup-blocked") {
        loginError.textContent = "Het inlogvenster is geblokkeerd. Sta pop-ups toe voor deze site en probeer het opnieuw.";
      } else {
        loginError.textContent = "Inloggen is mislukt. Probeer het opnieuw.";
      }
    });
  });

  logoutButton.addEventListener("click", () => {
    settingsDialog.close();
    signOut(auth).catch(console.error);
  });

  // Runs at start-up and every time someone signs in or out.
  onAuthStateChanged(auth, (user) => {
    authLoading.hidden = true;
    if (user) {
      settingsEmail.textContent = user.email;
      loginScreen.hidden = true;
      appContainer.hidden = false;
      onSignedIn();
    } else {
      onSignedOut();
      settingsDialog.close();
      appContainer.hidden = true;
      loginScreen.hidden = false;
    }
  });
}
