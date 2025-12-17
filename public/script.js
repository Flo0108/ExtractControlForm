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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------------------- Topic Colors --------------------
const topicColors = {
  Physical: "#FF5733",
  Environmental: "#33C1FF",
  Behavioral: "#33FF57",
  Atmospheric: "#FF33A8",
  Cultural: "#FFC133",
  Temporal: "#8D33FF"
};

// -------------------- State --------------------
let selectedTool = "Point";
let selectedTopic = "Physical";
let tempPoints = [];
let tempLayer = null;

// -------------------- Tool Sidebar --------------------
document.querySelectorAll("#tool-sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tool-sidebar button")
      .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTool = btn.dataset.tool;
    resetTemp();
    console.log("Tool:", selectedTool);
  });

  if (btn.dataset.tool === selectedTool) btn.classList.add("selected");
});

// -------------------- Topic Sidebar --------------------
document.querySelectorAll("#topic-sidebar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#topic-sidebar button")
      .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTopic = btn.dataset.topic;
    console.log("Topic:", selectedTopic);
  });

  if (btn.dataset.topic === selectedTopic) btn.classList.add("selected");
});

// -------------------- Map Setup --------------------
const map = L.map("map").setView([48.2082, 16.3738], 16);

const osm = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, opacity: 0.9 }
);

L.control.layers(
  { "Street Map": osm },
  { "Satellite": satellite },
  { position: "bottomleft" }
).addTo(map);

// -------------------- Geolocation --------------------
let userMarker = null;

map.locate({ watch: true, enableHighAccuracy: true });

map.on("locationfound", e => {
  const pos = [e.latitude, e.longitude];
  if (!userMarker) {
    userMarker = L.circleMarker(pos, {
      radius: 7,
      color: "#007aff",
      fillColor: "#2f80ed",
      fillOpacity: 0.9
    }).addTo(map);
    map.setView(pos, 17);
  } else {
    userMarker.setLatLng(pos);
  }
});

// -------------------- Click Router --------------------
map.on("click", e => {
  if (selectedTool === "Point") handlePoint(e.latlng);
  if (selectedTool === "Line" || selectedTool === "Arrow")
    handleLineLike(e.latlng);
});

// -------------------- Point --------------------
async function handlePoint(latlng) {
  const note = prompt("Note:");
  if (!note) return;

  const data = {
    type: "Point",
    geometry: { lat: latlng.lat, lng: latlng.lng },
    note,
    topic: selectedTopic,
    tool: selectedTool,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("pins").add(data);

  drawPoint(data);
}

function drawPoint(pin) {
  L.circleMarker(
    [pin.geometry.lat, pin.geometry.lng],
    {
      radius: 8,
      color: topicColors[pin.topic],
      fillColor: topicColors[pin.topic],
      fillOpacity: 0.9
    }
  )
    .addTo(map)
    .bindPopup(`<b>${pin.note}</b><br>${pin.topic} · Point`);
}

// -------------------- Line / Arrow --------------------
async function handleLineLike(latlng) {
  tempPoints.push([latlng.lat, latlng.lng]);

  if (tempPoints.length === 1) {
    tempLayer = L.polyline(tempPoints, {
      color: topicColors[selectedTopic],
      weight: 3,
      dashArray: selectedTool === "Arrow" ? "5,5" : null
    }).addTo(map);
    return;
  }

  if (tempPoints.length === 2) {
    const note = prompt("Note:");
    if (!note) return resetTemp();

    const data = {
      type: selectedTool,
      geometry: tempPoints.map(p => ({
        lat: p[0],
        lng: p[1]
      })),
      note,
      topic: selectedTopic,
      tool: selectedTool,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("pins").add(data);
    drawLineLike(data);
    resetTemp();
  }
}

function drawLineLike(pin) {
  L.polyline(pin.geometry, {
    color: topicColors[pin.topic],
    weight: 3,
    dashArray: pin.type === "Arrow" ? "5,5" : null
  }).addTo(map);

  if (pin.type === "Arrow") {
    L.marker(pin.geometry[1], {
      icon: L.divIcon({
        html: "➤",
        className: "",
        iconSize: [20, 20]
      })
    }).addTo(map);
  }
}

// -------------------- Reset --------------------
function resetTemp() {
  tempPoints = [];
  tempLayer = null;
}

// -------------------- Load Existing Data --------------------
async function loadPins() {
  const snapshot = await db.collection("pins").get();
  snapshot.docs.forEach(doc => {
    const pin = doc.data();
    if (pin.type === "Point") drawPoint(pin);
    if (pin.type === "Line" || pin.type === "Arrow") drawLineLike(pin);
  });
}

loadPins();
