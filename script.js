// Initialize map
const map = L.map('map').setView([48.2082, 16.3738], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// User location marker
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
map.on('locationerror', e => alert("Unable to get location. Allow GPS."));

// Load pins from server on page load
async function loadPins() {
  const res = await fetch('/getPins');
  const pins = await res.json();
  pins.forEach(pin => {
    L.marker([pin.lat, pin.lng]).addTo(map).bindPopup(pin.note);
  });
}
loadPins();

// Drop pin and save to server
map.on('click', async e => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  const note = prompt("Enter a note:");
  if (!note) return;
  const tags = prompt("Enter tags (comma-separated):")?.split(',').map(t => t.trim()) || [];

  const res = await fetch('/addPin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, note, tags })
  });
  const pin = await res.json();
  L.marker([pin.lat, pin.lng]).addTo(map).bindPopup(pin.note).openPopup();
});
