// Start-up file: navigation between the views, popup behavior,
// and connecting sign-in to the two lists. index.html loads only this file.
import { initAuth } from "./auth.js";
import { startGroceries, stopGroceries } from "./groceries.js";
import { startFreezer, stopFreezer } from "./freezer.js";

// ---------- Navigation ----------
// The part of the address after "#/" decides which view is shown.
const viewNames = ["home", "groceries", "freezer"];
const backLink = document.getElementById("back-link");

function showView() {
  let name = location.hash.replace("#/", "");
  if (!viewNames.includes(name)) name = "home";
  for (const viewName of viewNames) {
    document.getElementById("view-" + viewName).hidden = (viewName !== name);
  }
  backLink.hidden = (name === "home");
}

window.addEventListener("hashchange", showView);
showView();

// ---------- Popups ----------
const settingsDialog = document.getElementById("settings-dialog");
const freezerDialog = document.getElementById("freezer-dialog");

for (const dialog of [settingsDialog, freezerDialog]) {
  // A click on the dark area around the popup closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  for (const button of dialog.querySelectorAll("[data-close]")) {
    button.addEventListener("click", () => dialog.close());
  }
}

// ---------- Lists follow the sign-in ----------
function startListening() {
  startGroceries();
  startFreezer();
}

function stopListening() {
  stopGroceries();
  stopFreezer();
}

initAuth({
  onSignedIn() {
    // Always restart, so a switch directly from one account to another
    // (for example in another tab) never keeps the old list or listener.
    stopListening();
    startListening();
  },
  onSignedOut() {
    stopListening();
  }
});
