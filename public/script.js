console.log("Script loaded");

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

// -------------------- Topics & Colors --------------------
const topics = [
  { key: "Physical", description: "Materials, geometry, thresholds, edges, textures" },
  { key: "Environmental", description: "Light, sound, temperature, wind, smell" },
  { key: "Behavioral", description: "Movements, flows, informal uses, pauses, routines" },
  { key: "Atmospheric", description: "Vibes, rhythms, social intensity, emotional tone" },
  { key: "Cultural", description: "Local habits, shared meanings, events, signifiers" },
  { key: "Temporal", description: "Daily patterns, seasonality, change over time, cycles" }
];

const topicColors = {
  Physical: "#FF5733",
  Environmental: "#33C1FF",
  Behavioral: "#33FF57",
  Atmospheric: "#FF33A8",
  Cultural: "#FFC133",
  Temporal: "#8D33FF"
};

// -------------------- Tools --------------------
const tools = ["Point", "Line", "Arrow", "Area", "Volume"];
let selectedTool = "Point";

// -------------------- Sidebar Tool Selection --------------------
const buttons = document.querySelectorAll("#tool-sidebar button");
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTool = btn.dataset.tool;
    console.log("Selected tool:", selectedTool);
    resetTempGeometry();
  });
  if (btn.dataset.tool === selectedTool) btn.classList.add("selected");
});

// -------------------- Map Setup --------------------
const map = L.map('map').setView([48.2082, 16.3738], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let userMarker = null;
map.locate({ watch: true, enableHighAccuracy: true });
map.on('locationfound', e => {
  const lat = e.latitude, lng = e.longitude;
  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], { radius: 8, color: "#007aff", fillColor: "#2f80ed", fillOpacity: 0.9 }).addTo(map);
    map.setView([lat, lng], 17);
  } else userMarker.setLatLng([lat, lng]);
});
map.on('locationerror', e => console.error("Location error:", e.message));

// -------------------- Temporary storage for multi-point tools --------------------
let tempPoints = [];
let tempLayer = null;

function resetTempGeometry() {
  tempPoints = [];
  if (tempLayer) {
    map.removeLayer(tempLayer);
    tempLayer = null;
  }
}

// -------------------- Helper: Select Topic --------------------
function selectTopic() {
  const topicOptions = topics.map((t, i) => `${i + 1}: ${t.key}`).join("\n");
  let topicIndex = parseInt(prompt(`Choose a topic:\n${topicOptions}`)) - 1;
  if (topicIndex < 0 || topicIndex >= topics.length) topicIndex = 0;
  return topics[topicIndex].key;
}

// -------------------- Load Existing Pins --------------------
async function loadPins() {
  try {
    const snapshot = await db.collection("pins").get();
    const pins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    pins.forEach(pin => {
      switch (pin.tool) {
        case "Point":
          addMapPoint(pin);
          break;
        case "Line":
        case "Arrow":
          addMapLine(pin);
          break;
        case "Area":
        case "Volume":
          addMapPolygon(pin);
          break;
      }
    });
  } catch (err) {
    console.error("Failed to load pins:", err);
  }
}
loadPins();

// -------------------- Map Additions --------------------
map.on('click', e => handleMapClick(e.latlng));

function handleMapClick(latlng) {
  switch (selectedTool) {
    case "Point":
      addPoint(latlng);
      break;
    case "Line":
    case "Arrow":
      addLinePoint(latlng);
      break;
    case "Area":
    case "Volume":
      addPolygonPoint(latlng);
      break;
  }
}

// -------------------- Add Point --------------------
async function addPoint(latlng) {
  const note = prompt("Enter note for this pin:");
  if (!note) return;
  const topic = selectTopic();
  const color = topicColors[topic] || "#007aff";

  try {
    const docRef = await db.collection("pins").add({
      tool: "Point",
      lat: latlng.lat,
      lng: latlng.lng,
      note,
      topic,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    addMapPoint({ id: docRef.id, lat: latlng.lat, lng: latlng.lng, note, topic, tool: "Point" });
  } catch (err) {
    console.error("Failed to save point:", err);
  }
}

function addMapPoint(pin) {
  L.circleMarker([pin.lat, pin.lng], {
    radius: 8,
    color: topicColors[pin.topic] || "#007aff",
    fillColor: topicColors[pin.topic] || "#2f80ed",
    fillOpacity: 0.9
  }).addTo(map).bindPopup(`<b>${pin.note}</b><br>Topic: ${pin.topic}<br>Tool: ${pin.tool}`);
}

// -------------------- Add Line / Arrow --------------------
function addLinePoint(latlng) {
  tempPoints.push([latlng.lat, latlng.lng]);
  if (tempLayer) map.removeLayer(tempLayer);

  if (tempPoints.length > 1) {
    tempLayer = L.polyline(tempPoints, { color: "#000", weight: 3 }).addTo(map);
  }
  // Finish line on double click
  map.once('dblclick', async () => {
    if (tempPoints.length < 2) return resetTempGeometry();
    const note = prompt("Enter note for this line:");
    const topic = selectTopic();
    try {
      const docRef = await db.collection("pins").add({
        tool: selectedTool,
        points: tempPoints,
        note,
        topic,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      addMapLine({ id: docRef.id, points: tempPoints, note, topic, tool: selectedTool });
    } catch (err) {
      console.error("Failed to save line:", err);
    }
    resetTempGeometry();
  });
}

function addMapLine(pin) {
  L.polyline(pin.points, { color: topicColors[pin.topic] || "#000", weight: 3 }).addTo(map)
    .bindPopup(`<b>${pin.note}</b><br>Topic: ${pin.topic}<br>Tool: ${pin.tool}`);
}

// -------------------- Add Area / Volume --------------------
function addPolygonPoint(latlng) {
  tempPoints.push([latlng.lat, latlng.lng]);
  if (tempLayer) map.removeLayer(tempLayer);

  if (tempPoints.length > 2) {
    tempLayer = L.polygon(tempPoints, { color: topicColors[selectedTool] || "#000", fillColor: topicColors[selectedTool] || "#000", fillOpacity: 0.3 }).addTo(map);
  }
  // Finish polygon on double click
  map.once('dblclick', async () => {
    if (tempPoints.length < 3) return resetTempGeometry();
    const note = prompt("Enter note for this polygon:");
    const topic = selectTopic();
    try {
      const docRef = await db.collection("pins").add({
        tool: selectedTool,
        points: tempPoints,
        note,
        topic,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      addMapPolygon({ id: docRef.id, points: tempPoints, note, topic, tool: selectedTool });
    } catch (err) {
      console.error("Failed to save polygon:", err);
    }
    resetTempGeometry();
  });
}

function addMapPolygon(pin) {
  L.polygon(pin.points, {
    color: topicColors[pin.topic] || "#000",
    fillColor: topicColors[pin.topic] || "#000",
    fillOpacity: 0.3
  }).addTo(map)
    .bindPopup(`<b>${pin.note}</b><br>Topic: ${pin.topic}<br>Tool: ${pin.tool}`);
}
