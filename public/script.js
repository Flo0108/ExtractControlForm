console.log("SCRIPT.JS LOADED");

// Firebase setup
const firebaseConfig = {
  apiKey: "...",
  authDomain: "situated-mapping.firebaseapp.com",
  projectId: "situated-mapping",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


// -------------------- Topic Colors (orange-based tones) --------------------
const topicColors = {
  Physical: "#c75430",   // base orange
  Environmental: "#d26c42", // lighter, warmer
  Behavioral: "#b24728",   // darker, richer
  Atmospheric: "#e07a50",  // softer, peachy
  Cultural: "#aa3f20",      // deep, brownish-orange
  Temporal: "#db7c56"       // brighter, slightly redder
};

// -------------------- State --------------------
let screenGridLayer; // ✅ declare first
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
const map = L.map("map").setView([48.2082, 16.3738], 15);
screenGridLayer = L.layerGroup();
screenGridLayer.addTo(map); // on by default



const osm = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);


L.tileLayer.wms(
  "https://services.inspire.gv.at/ogd/ortho/WMS",
  {
    layers: 'ortho',
    format: 'image/png',
    transparent: false,
    version: '1.1.1',
    crs: L.CRS.EPSG3857,
    attribution: '© Stadt Wien – Orthofoto'
  }
).addTo(map);

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, opacity: 0.7 }  // slightly transparent
).addTo(map);

// Apply greyscale + subtle brightness/contrast
satellite.getContainer().style.filter = "grayscale(80%) brightness(90%) contrast(90%)";

L.control.layers(
  {
    "Street Map": osm
  },
  {
    "Satellite": satellite,
    "Recursion Grid": screenGridLayer
  },
  { position: "bottomleft" }
).addTo(map);
map.addLayer(satellite); // show satellite first

// -------------------- Thumbnail Icon with Orange Outline --------------------
function createThumbnailIcon(imgPath) {
  return L.divIcon({
    className: "thumbnail-icon",
    html: `<div style="
            width: 32px;
            height: 32px;
            border: 1px solid #c75430;  /* orange outline */
            border-radius: 4px;        /* optional rounded corners */
            overflow: hidden;
          ">
            <img src="${imgPath}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>`,
    iconSize: [32, 32],
    iconAnchor: [12, 12], // center of the icon
    popupAnchor: [0, -12]
  });
}




// -------------------- Load Image Markers (optimized, non-overlapping) --------------------
const imagePoints = []; // store locations if needed for other purposes
const imageLayerGroup = L.layerGroup().addTo(map); // all images + backgrounds

async function loadImages() {
  const res = await fetch("./images.json");
  const data = await res.json();

  // Keep track of screen positions to avoid overlaps
  const placedMarkers = [];

  Object.values(data).forEach(entry => {
    if (
      !entry.metadata ||
      !entry.metadata.location ||
      typeof entry.metadata.location.lat !== "number" ||
      typeof entry.metadata.location.lon !== "number"
    ) {
      console.warn("Image skipped (no valid location):", entry.image_file);
      return;
    }

    const { lat, lon } = entry.metadata.location;
    imagePoints.push({ lat, lon }); // store for other purposes

    const imgPath = `/images/${entry.image_file}`;


    // Convert lat/lng to screen coordinates
    const screenPos = map.latLngToContainerPoint([lat, lon]);

    // Check if it overlaps any existing marker (24px threshold)
    const overlap = placedMarkers.some(p =>
      Math.abs(p.x - screenPos.x) < 26 && Math.abs(p.y - screenPos.y) < 26
    );
    if (overlap) return; // skip this marker

    placedMarkers.push(screenPos);

    const marker = L.marker([lat, lon], { icon: createThumbnailIcon(imgPath) }).addTo(imageLayerGroup);

    marker.bindPopup(`
      <img src="${imgPath}" style="width:200px; display:block;">
      <small>${entry.metadata.timestamp || ""}</small>
    `);
  });
}

// Redraw markers when map moves or zooms
map.on("moveend zoomend", async () => {
  imageLayerGroup.clearLayers();
  await loadImages();
});


loadImages();









const maxSubdivision = 4;
const minDistance = 20; // pixels for max subdivision
const baseSize = 100;   // initial cell size in pixels



function drawScreenFixedGrid(points) {
  if (!map.hasLayer(screenGridLayer)) return; // ⛔ skip when hidden
  screenGridLayer.clearLayers();
  const mapSize = map.getSize(); // width & height in pixels


  // -------------------- Compute all points for subdivision --------------------

  // Start with image points
  let screenPoints = imagePoints.map(p => map.latLngToContainerPoint([p.lat, p.lon]));

  // Include user-added points and line vertices
  map.eachLayer(layer => {
    if (layer instanceof L.LayerGroup) {
      // Drill into layer groups
      layer.eachLayer(subLayer => {
        if (subLayer instanceof L.CircleMarker) {
          screenPoints.push(map.latLngToContainerPoint(subLayer.getLatLng()));
        } else if (subLayer instanceof L.Polyline && !(subLayer instanceof L.Polygon)) {
          // Lines or arrows (skip polygons)
          subLayer.getLatLngs().forEach(ll => {
            screenPoints.push(map.latLngToContainerPoint(ll));
          });
        }
      });
    } else {
      // Top-level points or lines
      if (layer instanceof L.CircleMarker) {
        screenPoints.push(map.latLngToContainerPoint(layer.getLatLng()));
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        layer.getLatLngs().forEach(ll => {
          screenPoints.push(map.latLngToContainerPoint(ll));
        });
      }
    }
  });


  // Recursive subdivision function
  function subdivide(x0, y0, size, depth, toggleRow) {
    const half = size / 2;
    const cx = x0 + half;
    const cy = y0 + half;

    // distance to closest point (precomputed)
    let closestDist = Infinity;
    for (const sp of screenPoints) {
      const dx = sp.x - cx;
      const dy = sp.y - cy;
      const dist = dx * dx + dy * dy; // squared distance is faster
      if (dist < closestDist) closestDist = dist;
    }

    // decide if subdivide
    if (depth < maxSubdivision && closestDist < (minDistance * Math.pow(2, maxSubdivision - depth)) ** 2) {
      subdivide(x0, y0, half, depth + 1, toggleRow);
      subdivide(x0 + half, y0, half, depth + 1, !toggleRow);
      subdivide(x0, y0 + half, half, depth + 1, !toggleRow);
      subdivide(x0 + half, y0 + half, half, depth + 1, toggleRow);
      return;
    }

    // fill opacity based on depth
    const opacity = 1 - depth / maxSubdivision;
    const fillColor = "#ffffff"; // remove unused orange chance for speed

    L.rectangle(
      [
        map.containerPointToLatLng([x0, y0]),
        map.containerPointToLatLng([x0 + size, y0 + size])
      ],
      {
        color: "#ffffff",
        weight: 0.1,
        fillColor,
        fillOpacity: opacity,
        interactive: false
      }
    ).addTo(screenGridLayer);
  }

  // initial grid loop
  for (let y = 0, toggleRow = false; y < mapSize.y; y += baseSize, toggleRow = !toggleRow) {
    for (let x = 0, toggle = toggleRow; x < mapSize.x; x += baseSize, toggle = !toggle) {
      subdivide(x, y, baseSize, 0, toggle);
    }
  }
}

// redraw on move, zoom, or resize
map.on("move zoom resize", () => drawScreenFixedGrid(imagePoints));
drawScreenFixedGrid(imagePoints);






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

    // Remove automatic setView so the initial Vienna view stays
    // map.setView(pos, 17);
  } else {
    userMarker.setLatLng(pos);
  }
});

// -------------------- Click Router --------------------
map.on("click", e => {
  if (selectedTool === "Point") handlePoint(e.latlng);
  if (selectedTool === "Line" || selectedTool === "Arrow") handleLineLike(e.latlng);
  if (selectedTool === "Polygon") handlePolygonClick(e.latlng);
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

  await db.collection("pins").add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

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

  // 🔹 Refresh grid after drawing a new point
  drawScreenFixedGrid(imagePoints);
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

  // 🔹 Refresh grid after drawing a new line/arrow
  drawScreenFixedGrid(imagePoints);
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
      geometry: tempPoints.map(p => ({ lat: p[0], lng: p[1] })),
      note,
      topic: selectedTopic,
      tool: selectedTool,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // ⬅ compat API syntax
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


let tempPolygonPoints = [];
let tempPolygonLayer = null;

async function handlePolygonClick(latlng) {
  console.log("Polygon mode click!", latlng)
  // Add clicked point
  tempPolygonPoints.push([latlng.lat, latlng.lng]);

  // Draw temporary polygon on the map
  if (tempPolygonLayer) {
    tempPolygonLayer.setLatLngs(tempPolygonPoints);
  } else {
    tempPolygonLayer = L.polygon(tempPolygonPoints, {
      color: topicColors[selectedTopic],
      weight: 3,
      fillOpacity: 0.2
    }).addTo(map);
  }

  // Optional: minimum 3 points to finish
  if (tempPolygonPoints.length >= 3) {
    // Instead of prompt here, trigger via a sidebar "Finish Polygon" button
    console.log("Polygon ready to finish. Click 'Finish Polygon' to save.");
  }
}

function toggleFinishPolygonButton(show) {
  const btn = document.getElementById("finishPolygonBtn");
  btn.style.display = show ? "inline-block" : "none";
}

// Polygon click handler
async function handlePolygonClick(latlng) {
  tempPolygonPoints.push([latlng.lat, latlng.lng]);

  if (tempPolygonLayer) {
    tempPolygonLayer.setLatLngs(tempPolygonPoints);
  } else {
    tempPolygonLayer = L.polygon(tempPolygonPoints, {
      color: topicColors[selectedTopic],
      weight: 3,
      fillOpacity: 0.2
    }).addTo(map);
  }

  toggleFinishPolygonButton(tempPolygonPoints.length >= 3);
}

// Reset polygon when switching tools
function resetPolygon() {
  tempPolygonPoints = [];
  toggleFinishPolygonButton(false);
  if (tempPolygonLayer) {
    map.removeLayer(tempPolygonLayer);
    tempPolygonLayer = null;
  }
}

// Listen to finish button
document.getElementById("finishPolygonBtn").addEventListener("click", async () => {
  if (tempPolygonPoints.length < 3) return alert("Add at least 3 points.");

  const note = prompt("Note for this area:");
  if (!note) return;

  const data = {
    type: "Polygon",
    geometry: tempPolygonPoints.map(p => ({ lat: p[0], lng: p[1] })),
    note,
    topic: selectedTopic,
    tool: "Polygon",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("pins").add(data);

  L.polygon(tempPolygonPoints, {
    color: topicColors[selectedTopic],
    fillColor: topicColors[selectedTopic],
    fillOpacity: 0.2
  }).addTo(map);

  resetPolygon();
  drawScreenFixedGrid(imagePoints);
});

// Finish button logic (add this to your sidebar)
document.getElementById("finishPolygonBtn").addEventListener("click", async () => {
  if (tempPolygonPoints.length < 3) return alert("Add at least 3 points.");

  const note = prompt("Note for this area:");
  if (!note) return;

  const data = {
    type: "Polygon",
    geometry: tempPolygonPoints.map(p => ({ lat: p[0], lng: p[1] })),
    note,
    topic: selectedTopic,
    tool: "Polygon",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await addDoc(collection(db, "pins"), { ...data, createdAt: serverTimestamp() });

  // Draw finalized polygon
  L.polygon(tempPolygonPoints, {
    color: topicColors[selectedTopic],
    weight: 3,
    fillOpacity: 0.2
  }).addTo(map);

  // Reset temp
  tempPolygonPoints = [];
  if (tempPolygonLayer) {
    map.removeLayer(tempPolygonLayer);
    tempPolygonLayer = null;
  }

  // Refresh your recursion grid
  drawScreenFixedGrid(imagePoints);
});


function resetPolygon() {
  tempPolygonPoints = [];
  if (tempPolygonLayer) {
    map.removeLayer(tempPolygonLayer);
    tempPolygonLayer = null;
  }
}




// -------------------- Reset --------------------
function resetTemp() {
  tempPoints = [];
  tempLayer = null;
}

// -------------------- Load Existing Data --------------------
async function loadPins() {
  console.log("Loading pins…");

  const snapshot = await db.collection("pins").get();

  console.log("Pin count:", snapshot.size);

  snapshot.forEach(doc => {
    const data = doc.data();

    console.log("PIN:", doc.id, data);

    // TEMP: visualize later
    addPinToMap(data);
  });
}

loadPins();



function addPinToMap(pin) {
  if (!pin.geometry) return;

  if (pin.type === "Point") {
    const { lat, lng } = pin.geometry;
    L.circleMarker([lat, lng], {
      radius: 8,
      color: topicColors[pin.topic],
      fillColor: topicColors[pin.topic],
      fillOpacity: 0.9
    }).addTo(map)
      .bindPopup(`<b>${pin.note || "No note"}</b><br>${pin.topic || "No topic"} · Point`);
  }

  if (pin.type === "Line" || pin.type === "Arrow") {
    L.polyline(pin.geometry, {
      color: topicColors[pin.topic],
      weight: 3,
      dashArray: pin.type === "Arrow" ? "5,5" : null
    }).addTo(map);
  }

  if (pin.type === "Polygon") {
    L.polygon(pin.geometry, {
      color: topicColors[pin.topic],
      fillColor: topicColors[pin.topic],
      fillOpacity: 0.4
    }).addTo(map)
      .bindPopup(`<b>${pin.note || "No note"}</b><br>${pin.topic || "No topic"} · Area`);
  }
}

// -------------------- Studies Overlay (Map Coordinates) --------------------
let studiesLayer = L.layerGroup().addTo(map);

// Define the four study areas (lat/lng bounds)
const studies = [
  {
    name: "Study 1",
    bounds: [
      [48.197211, 16.302355], // southwest corner
      [48.192791, 16.311071]  // northeast corner
    ]
  },
  {
    name: "Study 2",
    bounds: [
      [48.21608, 16.31946],
      [48.21150, 16.32826]
    ]
  },
  {
    name: "Study 3",
    bounds: [
      [48.192505, 16.349909],
      [48.187463, 16.358256]
    ]
  },
  {
    name: "Study 4",
    bounds: [
      [48.20607, 16.38664],
      [48.19620, 16.40145]
    ]
  }
];

function drawStudiesOverlay() {
  studiesLayer.clearLayers();

  studies.forEach(s => {
    // Draw rectangle
    L.rectangle(s.bounds, {
      color: "#c75430",
      weight: 2,
      fillColor: "#ff660020", // semi-transparent
      interactive: false
    }).addTo(studiesLayer);

    // Add label at top-left of rectangle
    const sw = s.bounds[0]; // southwest corner
    const ne = s.bounds[1]; // northeast corner
    const labelLat = ne[0]; // use north for top
    const labelLng = sw[1]; // use west for left

    L.marker([labelLat, labelLng], {
      icon: L.divIcon({
        className: "study-label",
        html: `<span style="color:#c75430; font-weight:bold;">Study ${s.name.split(' ')[1]}</span>`,
        iconAnchor: [0, 0]
      }),
      interactive: false
    }).addTo(studiesLayer);
  });
}


drawStudiesOverlay();
studiesLayer.bringToFront(); // always on top



