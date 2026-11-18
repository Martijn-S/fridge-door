// Start-up file: navigation between the views, popup behavior,
// and connecting sign-in to the two lists. index.html loads only this file.
import { initAuth } from "./auth.js";
import { startGroceries, stopGroceries } from "./groceries.js";
// The "?v=3" is a version tag: raise it when freezer.js changes, so phones load the new copy.
import { startFreezer, stopFreezer } from "./freezer.js?v=3";

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
// Every popup on the page (also ones added later): a click on the dark area
// around it closes it, and so does any button inside it marked data-close.
for (const dialog of document.querySelectorAll("dialog")) {
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
