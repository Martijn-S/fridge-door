// The freezer page ("Vriezer"): list, adding, editing, the detail popup and "used some".
import {
  db, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "./firebase.js";

const freezerCollection = collection(db, "freezerItems");

const chevronIcon = '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const minusIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';

// Each item: text, addedAt (set by the server, or a day the user picked),
// expiresOn ("YYYY-MM-DD" or null), amountType ("count", "grams" or null)
// and amount (a whole number or null). Older items have no amount.
let freezerItems = [];
let unsubscribeFreezer = null;
let openFreezerId = null;
let useItemId = null;
let removeItemId = null;

// Item popup
const freezerDialog = document.getElementById("freezer-dialog");
const freezerView = document.getElementById("freezer-view");
const freezerTitle = document.getElementById("freezer-dialog-title");
const freezerEdit = document.getElementById("freezer-edit");
const freezerAmount = document.getElementById("freezer-amount");
const freezerAdded = document.getElementById("freezer-added");
const freezerExpires = document.getElementById("freezer-expires");
const freezerDelete = document.getElementById("freezer-delete");

// Edit form (inside the item popup)
const editForm = document.getElementById("freezer-edit-form");
const editName = document.getElementById("edit-name");
const editAmount = document.getElementById("edit-amount");
const editUnit = document.getElementById("edit-unit");
const editSince = document.getElementById("edit-since");
const editExpires = document.getElementById("edit-expires");
const editCancel = document.getElementById("edit-cancel");

// "Used some" popup (grams) and "remove?" popup
const useDialog = document.getElementById("use-dialog");
const useForm = document.getElementById("use-form");
const useTitle = document.getElementById("use-title");
const useInput = document.getElementById("use-input");
const useHint = document.getElementById("use-hint");
const removeDialog = document.getElementById("remove-dialog");
const removeText = document.getElementById("remove-text");
const removeConfirm = document.getElementById("remove-confirm");

// List and add form
const freezerList = document.getElementById("freezer-list");
const freezerForm = document.getElementById("freezer-form");
const freezerInput = document.getElementById("new-freezer-item");
const freezerAmountInput = document.getElementById("new-freezer-amount");
const freezerUnit = document.getElementById("new-freezer-unit");
const sinceButton = document.getElementById("new-freezer-since-button");
const sinceInput = document.getElementById("new-freezer-since");
const freezerDate = document.getElementById("new-freezer-date");
const freezerStatus = document.getElementById("freezer-status");

const dateFormat = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// "2026-11-05" -> 5 november 2026. Built from parts so time zones cannot shift the day.
function formatDay(text) {
  const [year, month, day] = text.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

// A Date -> "YYYY-MM-DD" in local time.
function dateToText(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

// "YYYY-MM-DD" -> a Date at noon local time, so the day stays the same in any time zone.
function dayToDate(text) {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function todayText() {
  return dateToText(new Date());
}

function isExpired(item) {
  return Boolean(item.expiresOn) && item.expiresOn < todayText();
}

function hasAmount(item) {
  return Number.isFinite(item.amount) && item.amount > 0;
}

// 3 -> "3x", 500 grams -> "500 g"
function formatAmount(item) {
  return item.amountType === "grams" ? item.amount + " g" : item.amount + "x";
}

function findItem(id) {
  return freezerItems.find((i) => i.id === id);
}

function showError(error) {
  console.error(error);
  freezerStatus.textContent = "Er ging iets mis. Probeer het opnieuw.";
}

// ---------- Amount fields (number + "Aantal / Gram" switch) ----------

function getUnit(toggle) {
  return toggle.querySelector(".segment.active").dataset.unit;
}

function setUnit(toggle, unit) {
  for (const segment of toggle.querySelectorAll(".segment")) {
    const on = segment.dataset.unit === unit;
    segment.classList.toggle("active", on);
    segment.setAttribute("aria-pressed", String(on));
  }
}

for (const toggle of document.querySelectorAll(".unit-toggle")) {
  toggle.addEventListener("click", (event) => {
    const segment = event.target.closest(".segment");
    if (segment) setUnit(toggle, segment.dataset.unit);
  });
}

// An empty or zero amount means "no amount": both fields become null.
function readAmount(input, toggle) {
  const value = Math.round(Number(input.value));
  if (input.value === "" || !Number.isFinite(value) || value <= 0) {
    return { amountType: null, amount: null };
  }
  return { amountType: getUnit(toggle), amount: value };
}

// ---------- "In de vriezer sinds": says "Vandaag" until tapped ----------

function resetSince() {
  sinceInput.hidden = true;
  sinceInput.value = "";
  sinceButton.hidden = false;
}

sinceButton.addEventListener("click", () => {
  sinceButton.hidden = true;
  sinceInput.hidden = false;
  sinceInput.max = todayText();
  sinceInput.value = todayText();
  sinceInput.focus();
  if (sinceInput.showPicker) {
    try { sinceInput.showPicker(); } catch (error) { /* the field is still usable by hand */ }
  }
});

// ---------- The list ----------

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
    if (hasAmount(item)) {
      const amount = document.createElement("span");
      amount.className = "amount";
      amount.textContent = formatAmount(item);
      button.appendChild(amount);
    }
    if (isExpired(item)) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = "Verlopen";
      button.appendChild(pill);
    }
    button.insertAdjacentHTML("beforeend", chevronIcon);
    button.addEventListener("click", () => openFreezerDialog(item.id));
    li.appendChild(button);

    // A separate button for "some of it was used". Only for items that have an amount.
    if (hasAmount(item)) {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "use-button";
      use.setAttribute("aria-label", "Minder " + item.text);
      use.title = "Minder";
      use.innerHTML = minusIcon;
      use.addEventListener("click", () => useSome(item.id));
      li.appendChild(use);
    }

    freezerList.appendChild(li);
  }
  refreshFreezerDialog();
  closeDialogsOfRemovedItems();
}

// If an item disappears (for example on the other phone), its popups close.
function closeDialogsOfRemovedItems() {
  if (useDialog.open && !findItem(useItemId)) useDialog.close();
  if (removeDialog.open && !findItem(removeItemId)) removeDialog.close();
}

// ---------- "Minder" (a part was eaten) ----------

function useSome(id) {
  const item = findItem(id);
  if (!item || !hasAmount(item)) return;
  if (item.amountType === "grams") {
    openUseDialog(item);
  } else if (item.amount > 1) {
    saveChanges(id, { amount: item.amount - 1 });
  } else {
    openRemoveDialog(item);   // the last one: ask first
  }
}

function openUseDialog(item) {
  useItemId = item.id;
  useTitle.textContent = item.text;
  useHint.textContent = "Nu: " + formatAmount(item);
  useInput.value = "";
  useInput.max = "";
  useDialog.showModal();
}

useForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const item = findItem(useItemId);
  const used = Math.round(Number(useInput.value));
  if (!item || !Number.isFinite(used) || used <= 0) return;
  useDialog.close();
  if (used >= item.amount) {
    openRemoveDialog(item);   // all of it is used: ask first
  } else {
    saveChanges(item.id, { amount: item.amount - used });
  }
});

function openRemoveDialog(item) {
  removeItemId = item.id;
  removeText.textContent = "Is " + item.text + " op? Dan wordt het uit de vriezer verwijderd.";
  removeDialog.showModal();
}

removeConfirm.addEventListener("click", () => {
  const id = removeItemId;
  removeDialog.close();
  deleteDoc(doc(db, "freezerItems", id)).catch(showError);
});

function saveChanges(id, changes) {
  return updateDoc(doc(db, "freezerItems", id), changes).catch(showError);
}

// ---------- The item popup ----------

function openFreezerDialog(id) {
  openFreezerId = id;
  resetFreezerDelete();
  showEditMode(false);
  refreshFreezerDialog();
  if (!freezerDialog.open) freezerDialog.showModal();
}

function showEditMode(on) {
  freezerView.hidden = on;
  editForm.hidden = !on;
}

// Fills the details. Also runs when the list changes while the popup is open.
// It never touches the edit form, so typing is not interrupted.
function refreshFreezerDialog() {
  if (openFreezerId === null) return;
  const item = findItem(openFreezerId);
  if (!item) {
    // Removed (for example on the other phone).
    if (freezerDialog.open) freezerDialog.close();
    return;
  }
  freezerTitle.textContent = item.text;
  freezerAmount.textContent = hasAmount(item) ? formatAmount(item) : "Niet ingevuld";
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
  deleteDoc(doc(db, "freezerItems", id)).catch(showError);
});

freezerDialog.addEventListener("close", () => {
  openFreezerId = null;
  resetFreezerDelete();
  showEditMode(false);
});

// ---------- Editing ----------

freezerEdit.addEventListener("click", () => {
  const item = findItem(openFreezerId);
  if (!item) return;
  editName.value = item.text;
  setUnit(editUnit, item.amountType === "grams" ? "grams" : "count");
  editAmount.value = hasAmount(item) ? item.amount : "";
  editSince.value = item.addedAt ? dateToText(item.addedAt.toDate()) : "";
  editSince.max = todayText();
  editExpires.value = item.expiresOn || "";
  showEditMode(true);
});

editCancel.addEventListener("click", () => showEditMode(false));

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const item = findItem(openFreezerId);
  const name = editName.value.trim();
  if (!item || name === "") return;
  const changes = {
    text: name,
    expiresOn: editExpires.value || null,
    ...readAmount(editAmount, editUnit)
  };
  // Only touch "since" when the user actually changed the day.
  const originalSince = item.addedAt ? dateToText(item.addedAt.toDate()) : "";
  if (editSince.value && editSince.value !== originalSince) {
    changes.addedAt = dayToDate(editSince.value);
  }
  showEditMode(false);
  saveChanges(item.id, changes);
});

// ---------- Live updates ----------

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
  if (useDialog.open) useDialog.close();
  if (removeDialog.open) removeDialog.close();
  renderFreezer();
}

// ---------- Adding ----------

freezerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = freezerInput.value.trim();
  if (value === "") return;
  const expiresOn = freezerDate.value || null;
  const { amountType, amount } = readAmount(freezerAmountInput, freezerUnit);
  // Today (the default) uses the server's clock; another day is stored as that day.
  const since = sinceInput.value;
  const addedAt = since && since !== todayText() ? dayToDate(since) : serverTimestamp();

  freezerInput.value = "";
  freezerDate.value = "";
  freezerAmountInput.value = "1";
  setUnit(freezerUnit, "count");
  resetSince();

  addDoc(freezerCollection, {
    text: value,
    expiresOn: expiresOn,
    amountType: amountType,
    amount: amount,
    addedAt: addedAt
  }).catch(showError);
});
