// The freezer page ("Vriezer"): list, adding, and the detail popup.
import {
  db, collection, addDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "./firebase.js";

const freezerCollection = collection(db, "freezerItems");

const chevronIcon = '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

// Each item: text, addedAt (set by the server), expiresOn ("YYYY-MM-DD" or null).
let freezerItems = [];
let unsubscribeFreezer = null;
let openFreezerId = null;

const freezerDialog = document.getElementById("freezer-dialog");
const freezerList = document.getElementById("freezer-list");
const freezerForm = document.getElementById("freezer-form");
const freezerInput = document.getElementById("new-freezer-item");
const freezerDate = document.getElementById("new-freezer-date");
const freezerStatus = document.getElementById("freezer-status");
const freezerTitle = document.getElementById("freezer-dialog-title");
const freezerAdded = document.getElementById("freezer-added");
const freezerExpires = document.getElementById("freezer-expires");
const freezerDelete = document.getElementById("freezer-delete");

const dateFormat = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// "2026-11-05" -> 5 november 2026. Built from parts so time zones cannot shift the day.
function formatDay(text) {
  const [year, month, day] = text.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

function todayText() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
}

function isExpired(item) {
  return Boolean(item.expiresOn) && item.expiresOn < todayText();
}

// Soonest expiry first; items without a date at the end.
function sortedFreezerItems() {
  return [...freezerItems].sort((a, b) => {
    if (a.expiresOn && b.expiresOn && a.expiresOn !== b.expiresOn) {
      return a.expiresOn.localeCompare(b.expiresOn);
    }
    if (a.expiresOn && !b.expiresOn) return -1;
    if (!a.expiresOn && b.expiresOn) return 1;
    return a.text.localeCompare(b.text, "nl");
  });
}

function renderFreezer() {
  freezerList.innerHTML = "";
  for (const item of sortedFreezerItems()) {
    const li = document.createElement("li");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-main";
    button.innerHTML = '<span class="item-name"></span>';
    button.querySelector(".item-name").textContent = item.text;
    if (isExpired(item)) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = "Verlopen";
      button.appendChild(pill);
    }
    button.insertAdjacentHTML("beforeend", chevronIcon);
    button.addEventListener("click", () => openFreezerDialog(item.id));

    li.appendChild(button);
    freezerList.appendChild(li);
  }
  refreshFreezerDialog();
}

function openFreezerDialog(id) {
  openFreezerId = id;
  resetFreezerDelete();
  refreshFreezerDialog();
  if (!freezerDialog.open) freezerDialog.showModal();
}

// Fills the popup. Also runs when the list changes while the popup is open.
function refreshFreezerDialog() {
  if (openFreezerId === null) return;
  const item = freezerItems.find((i) => i.id === openFreezerId);
  if (!item) {
    // Removed (for example on the other phone).
    if (freezerDialog.open) freezerDialog.close();
    return;
  }
  freezerTitle.textContent = item.text;
  freezerAdded.textContent = item.addedAt ? dateFormat.format(item.addedAt.toDate()) : "Onbekend";
  freezerExpires.textContent = item.expiresOn ? formatDay(item.expiresOn) : "Niet ingevuld";
  freezerExpires.classList.toggle("expired", isExpired(item));
}

// Removing needs a second tap, so it cannot happen by accident.
function resetFreezerDelete() {
  freezerDelete.classList.remove("armed");
  freezerDelete.textContent = "Verwijderen";
}

freezerDelete.addEventListener("click", () => {
  if (!freezerDelete.classList.contains("armed")) {
    freezerDelete.classList.add("armed");
    freezerDelete.textContent = "Tik nogmaals om te verwijderen";
    return;
  }
  const id = openFreezerId;
  freezerDialog.close();
  deleteDoc(doc(db, "freezerItems", id)).catch((error) => {
    console.error(error);
    freezerStatus.textContent = "Er ging iets mis. Probeer het opnieuw.";
  });
});

freezerDialog.addEventListener("close", () => {
  openFreezerId = null;
  resetFreezerDelete();
});

export function startFreezer() {
  if (unsubscribeFreezer) return;
  freezerStatus.textContent = "Laden…";
  unsubscribeFreezer = onSnapshot(
    query(freezerCollection, orderBy("addedAt")),
    (snapshot) => {
      freezerItems = snapshot.docs.map((d) => ({
        id: d.id,
        // "estimate" gives a temporary time for an item that is still being saved.
        ...d.data({ serverTimestamps: "estimate" })
      }));
      freezerStatus.textContent = freezerItems.length === 0 ? "De vriezer is leeg." : "";
      renderFreezer();
    },
    (error) => {
      // Only affects the freezer page. The "Geen toegang" screen is handled by the grocery list.
      console.error(error);
      freezerItems = [];
      renderFreezer();
      freezerStatus.textContent = "De vriezer kan niet worden geladen.";
    }
  );
}

export function stopFreezer() {
  if (unsubscribeFreezer) unsubscribeFreezer();
  unsubscribeFreezer = null;
  freezerItems = [];
  if (freezerDialog.open) freezerDialog.close();
  renderFreezer();
}

freezerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = freezerInput.value.trim();
  if (value === "") return;
  const expiresOn = freezerDate.value || null;
  freezerInput.value = "";
  freezerDate.value = "";
  addDoc(freezerCollection, {
    text: value,
    expiresOn: expiresOn,
    addedAt: serverTimestamp()
  }).catch((error) => {
    console.error(error);
    freezerStatus.textContent = "Er ging iets mis. Probeer het opnieuw.";
  });
});
