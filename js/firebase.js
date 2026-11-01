// Firebase setup. Every other file gets its Firebase tools from here,
// so the Firebase version number below only needs changing in this file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
export {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// This config is an identifier, not a password. The list is protected
// by sign-in plus the Firestore security rules.
const firebaseConfig = {
  apiKey: "AIzaSyA1JnfXqFbTLJZHy6ezOnxAf9HgKsyGIZM",
  authDomain: "grocery-list-a6627.firebaseapp.com",
  projectId: "grocery-list-a6627",
  storageBucket: "grocery-list-a6627.firebasestorage.app",
  messagingSenderId: "956088734560",
  appId: "1:956088734560:web:2c9f12b2ca46b5006bc405"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
