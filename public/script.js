console.log("SCRIPT.JS LOADED");

// -------------------- Firebase Setup --------------------
const firebaseConfig = {
  apiKey: "AIzaSyAOvze18XlGJh0XWx1_FqyFMDyCiTinPoQ",
  authDomain: "situated-mapping.firebaseapp.com",
  projectId: "situated-mapping",
  storageBucket: "situated-mapping.firebasestorage.app",
  messagingSenderId: "567912218624",
  appId: "1:567912218624:web:dfe05320f61986ff7398e5",
  measurementId: "G-5L4499RY6W"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------------------- Default selections --------------------
let selectedTool = "Point";
let selectedTopic = "Physical";

// -------------------- Tool Sidebar --------------------
const toolButtons = document.querySelectorAll("#tool-sidebar button");
toolButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    toolButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTool = btn.dataset.tool;
    console.log("Selected tool:", selectedTool);
  });
  if (btn.dataset.tool === selectedTool) btn.classList.add("selected");
});

// -------------------- Topic Sidebar --------------------
const topicButtons = document.querySelectorAll("#topic-sidebar button");
topicButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    topicButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTopic = btn.dataset.topic;
    console.log("Selected topic:", selectedTopic);
  });
  if (btn.dataset.topic === selectedTopic) btn.classList.add("selected");
});

// -------------------- Map Setup --------------------
const map = L.map('map').setView([48.2082, 16.3738], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let userMarker = null;

map.locate({ watch: true, enableHighAccuracy: true });
map.on('locationfound', e => {
  const lat = e.latitude;
  const lng = e.longitude;

  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], { radius: 8, color: "#007aff", fillColor: "#2f80ed", fillOpacity: 0.9 }).addTo(map);
    map.setView([lat, lng], 17);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
});

map.on('locationerror', e => console.error("Location error:", e.message));

// -------------------- Load Pins --------------------
async function loadPins() {
  console.log("Loading pins from Firestore...");
  try {
    const snapshot = await db.collection("pins").get();
    const pins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    pins.forEach(pin => {
      L.marker([pin.lat, pin.lng])
        .addTo(map)
        .bindPopup(`<b>${pin.note}</b><br>Topic: ${pin.topic}<br>Tool: ${pin.tool}`);
    });
  } catch (err) {
    console.error("Failed to load pins:", err);
  }
}
loadPins();

// -------------------- Add Pin on Click --------------------
map.on('click', async e => {
  console.log("Map clicked at:", e.latlng);

  if (selectedTool !== "Point") {
    alert(`Tool "${selectedTool}" not implemented yet. Only Points can be placed.`);
    return;
  }

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter note for this pin:");
  if (!note) return;

  try {
    const docRef = await db.collection("pins").add({
      lat,
      lng,
      note,
      topic: selectedTopic,
      tool: selectedTool,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const pin = { id: docRef.id, lat, lng, note, topic: selectedTopic, tool: selectedTool };
    L.marker([pin.lat, pin.lng])
      .addTo(map)
      .bindPopup(`<b>${pin.note}</b><br>Topic: ${pin.topic}<br>Tool: ${pin.tool}`)
      .openPopup();
  } catch (err) {
    console.error("Failed to save pin:", err);
    alert("Failed to save pin.");
  }
});
