// Drop pin with note and tags
map.on('click', async (e) => {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const note = prompt("Enter a note for this pin:");
  if (!note) return;

  const tags = prompt("Enter tags (comma-separated):")?.split(',').map(t => t.trim()) || [];

  // Send to server
  const res = await fetch('/addPin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, note, tags })
  });
  const pin = await res.json();

  // Add to map
  L.marker([pin.lat, pin.lng]).addTo(map).bindPopup(pin.note).openPopup();
});

// Load existing pins on page load
async function loadPins() {
  const res = await fetch('/getPins');
  const pins = await res.json();
  pins.forEach(pin => {
    L.marker([pin.lat, pin.lng]).addTo(map).bindPopup(pin.note);
  });
}

loadPins();
