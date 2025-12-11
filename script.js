// Initialize map
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

map.on('locationerror', e => {
  console.error("Location error:", e.message);
  alert("Unable to get your location. Please allow location access.");
});



loadPins();

// Drop a new pin
// Drop a new pin
map.on('click', async e => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter a note for this pin:");
  if (!note) return;

  const tagsInput = prompt("Enter tags (comma-separated):");
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

  try {
    const res = await fetch('/addPin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, note, tags })
    });
    const pin = await res.json();

    // Add to map with safe handling for tags
    L.marker([pin.lat, pin.lng])
      .addTo(map)
      .bindPopup(`<b>${pin.note}</b>${pin.tags && pin.tags.length ? '<br>Tags: ' + pin.tags.join(', ') : ''}`)
      .openPopup();
  } catch (err) {
    console.error("Failed to save pin:", err);
    alert("Failed to save pin.");
  }
});

// Load existing pins from server
async function loadPins() {
  try {
    const res = await fetch('/getPins');
    const pins = await res.json();
    pins.forEach(pin => {
      L.marker([pin.lat, pin.lng])
        .addTo(map)
        .bindPopup(`<b>${pin.note}</b>${pin.tags && pin.tags.length ? '<br>Tags: ' + pin.tags.join(', ') : ''}`);
    });
  } catch (err) {
    console.error("Failed to load pins:", err);
  }
}
