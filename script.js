// --- Initialize map ---
const map = L.map('map', { zoomControl: false }).setView([48.2082, 16.3738], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let userMarker = null;

// --- Watch user's live location ---
map.locate({ watch: true, enableHighAccuracy: true });

map.on('locationfound', (e) => {
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

map.on('locationerror', (e) => {
  console.error("Location error:", e.message);
  alert("Unable to get your location. Please allow location access.");
});

// --- Drop pins with notes ---
map.on('click', (e) => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter a note for this pin:");
  if (!note) return; // cancel if empty

  const marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup(note).openPopup();
});
