// -------------------- Firebase Setup --------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------------------- Map Setup --------------------
const map = L.map('map').setView([48.2082, 16.3738], 16); // Vienna default

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let userMarker = null;

// Watch live location
map.locate({ watch: true, enableHighAccuracy: true });
map.on('locationfound', e => {
  const lat = e.latitude;
  const lng = e.longitude;

  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: "#007aff",
      fillColor: "#2f80ed",
      fillOpacity: 0.9
    }).addTo(map);
    map.setView([lat, lng], 17);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
});

map.on('locationerror', e => console.error("Location error:", e.message));

// -------------------- Load Pins from Firestore --------------------
async function loadPins() {
  try {
    const snapshot = await db.collection("pins").get();
    const pins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    pins.forEach(pin => {
      L.marker([pin.lat, pin.lng])
        .addTo(map)
        .bindPopup(`<b>${pin.note}</b>${pin.tags && pin.tags.length ? '<br>Tags: ' + pin.tags.join(', ') : ''}`);
    });
  } catch (err) {
    console.error("Failed to load pins:", err);
  }
}
loadPins();

// -------------------- Add Pin on Map Click --------------------
map.on('click', async e => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter note for this pin:");
  if (!note) return;

  const tagsInput = prompt("Enter tags (comma-separated):");
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

  try {
    const docRef = await db.collection("pins").add({
      lat,
      lng,
      note,
      tags,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const pin = { id: docRef.id, lat, lng, note, tags };
    L.marker([pin.lat, pin.lng])
      .addTo(map)
      .bindPopup(`<b>${pin.note}</b>${pin.tags && pin.tags.length ? '<br>Tags: ' + pin.tags.join(', ') : ''}`)
      .openPopup();
  } catch (err) {
    console.error("Failed to save pin:", err);
    alert("Failed to save pin.");
  }
});
