// The grocery list ("Boodschappen"): showing, adding, checking off, removing.
import {
  db, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "./firebase.js";

const itemsCollection = collection(db, "groceryItems");

// Small icons used when the list is built in JavaScript.
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

let items = [];
let unsubscribeItems = null;

const list = document.getElementById("list");
const form = document.getElementById("add-form");
const input = document.getElementById("new-item");
const status = document.getElementById("status");
const noAccess = document.getElementById("no-access");
const views = document.getElementById("views");

function showError(error) {
  console.error(error);
  status.textContent = "Er ging iets mis. Probeer het opnieuw.";
}

function render() {
  list.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    if (item.done) li.classList.add("done");

    // The whole left part is one button: tap to check off / uncheck.
    const main = document.createElement("button");
    main.type = "button";
    main.className = "item-main";
    main.setAttribute("aria-pressed", item.done ? "true" : "false");
    main.innerHTML = '<span class="check">' + checkIcon + '</span><span class="item-name"></span>';
    main.querySelector(".item-name").textContent = item.text;
    main.addEventListener("click", () => {
      updateDoc(doc(db, "groceryItems", item.id), { done: !item.done })
        .catch(showError);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.innerHTML = closeIcon;
    remove.setAttribute("aria-label", "Verwijder " + item.text);
    remove.addEventListener("click", () => {
      deleteDoc(doc(db, "groceryItems", item.id)).catch(showError);
    });

    li.appendChild(main);
    li.appendChild(remove);
    list.appendChild(li);
  }
}

// Live updates: runs now and again whenever the list changes
// (also when the other phone changes something).
// Only started after sign-in, and stopped again on sign-out.
export function startGroceries() {
  if (unsubscribeItems) return;
  status.textContent = "Laden…";
  noAccess.hidden = true;
  views.hidden = false;
  unsubscribeItems = onSnapshot(
    query(itemsCollection, orderBy("createdAt")),
    (snapshot) => {
      items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      status.textContent = items.length === 0 ? "De lijst is leeg." : "";
      noAccess.hidden = true;
      views.hidden = false;
      render();
    },
    (error) => {
      console.error(error);
      // Never keep showing old items after an error.
      items = [];
      render();
      if (error.code === "permission-denied") {
        // The security rules refused this account: show only the message.
        views.hidden = true;
        noAccess.hidden = false;
      } else {
        status.textContent = "De lijst kan niet worden geladen.";
      }
    }
  );
}

export function stopGroceries() {
  if (unsubscribeItems) unsubscribeItems();
  unsubscribeItems = null;
  items = [];
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (value === "") return;
  input.value = "";
  addDoc(itemsCollection, {
    text: value,
    done: false,
    createdAt: serverTimestamp()
  }).catch(showError);
});
