console.log("Script loaded");
console.log("firebase object:", window.firebase);

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
console.log("Firebase app initialized:", app);

const db = firebase.firestore();
console.log("Firestore db object:", db);

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
  console.log("Loading pins from Firestore...");
  try {
    const snapshot = await db.collection("pins").get();
    console.log("Firestore snapshot:", snapshot);

    const pins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Pins loaded:", pins);

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


const topics = [
  { key: "Physical", description: "Materials, geometry, thresholds, edges, textures" },
  { key: "Environmental", description: "Light, sound, temperature, wind, smell" },
  { key: "Behavioral", description: "Movements, flows, informal uses, pauses, routines" },
  { key: "Atmospheric", description: "Vibes, rhythms, social intensity, emotional tone" },
  { key: "Cultural", description: "Local habits, shared meanings, events, signifiers" },
  { key: "Temporal", description: "Daily patterns, seasonality, change over time, cycles" }
];


// -------------------- Add Pin on Map Click --------------------
map.on('click', async e => {
  if (selectedTool !== "Point") {
    alert(`Tool "${selectedTool}" not implemented yet. Only Points can be placed.`);
    return;
  }

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter note for this pin:");
  if (!note) return;

  // Select topic
  let topicOptions = topics.map((t, i) => `${i + 1}: ${t.key}`).join("\n");
  let topicIndex = parseInt(prompt(`Choose a topic:\n${topicOptions}`)) - 1;
  if (topicIndex < 0 || topicIndex >= topics.length) topicIndex = 0;
  const selectedTopic = topics[topicIndex].key;

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




const tools = [
  { key: "Point", description: "Events, hotspots, singularities" },
  { key: "Line", description: "Flows, edges, movements, boundaries" },
  { key: "Arrow", description: "Directional forces" },
  { key: "Area", description: "Zones, fields, atmospheres" },
  { key: "Volume", description: "Anything extending vertically / occupies depth" }
];

// Default tool
let selectedTool = "Point";

function selectTool() {
  let toolOptions = tools.map((t, i) => `${i + 1}: ${t.key}`).join("\n");
  let toolIndex = parseInt(prompt(`Select tool:\n${toolOptions}`)) - 1;
  if (toolIndex < 0 || toolIndex >= tools.length) {
    alert("Invalid selection. Defaulting to Point tool.");
    toolIndex = 0;
  }
  selectedTool = tools[toolIndex].key;
  console.log("Selected tool:", selectedTool);
}

// Call once at start
selectTool();
