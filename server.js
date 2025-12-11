const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'pins.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure pins.json exists
fs.ensureFileSync(DATA_FILE);
if (!fs.existsSync(DATA_FILE) || fs.readFileSync(DATA_FILE, 'utf8') === '') {
  fs.writeJsonSync(DATA_FILE, []);
}

// Get all pins
app.get('/getPins', async (req, res) => {
  const pins = await fs.readJson(DATA_FILE);
  res.json(pins);
});

// Add a new pin
app.post('/addPin', async (req, res) => {
  const { lat, lng, note, tags } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "lat/lng required" });

  const pins = await fs.readJson(DATA_FILE);
  const newPin = {
    id: Date.now(),
    lat,
    lng,
    note: note || '',
    tags: tags || [],
    created_at: new Date().toISOString()
  };
  pins.push(newPin);
  await fs.writeJson(DATA_FILE, pins);
  res.json(newPin);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
