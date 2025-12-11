const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'pins.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure pins.json exists
fs.ensureFileSync(DATA_FILE);
if (!fs.existsSync(DATA_FILE) || fs.readFileSync(DATA_FILE, 'utf8') === '') {
  fs.writeJsonSync(DATA_FILE, []);
}

// GET all pins
app.get('/getPins', async (req, res) => {
  try {
    const pins = await fs.readJson(DATA_FILE).catch(() => []);
    res.json(pins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read pins' });
  }
});

// POST a new pin
app.post('/addPin', async (req, res) => {
  try {
    const { lat, lng, note = '', tags = [] } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat/lng required' });

    const pins = await fs.readJson(DATA_FILE).catch(() => []);
    const newPin = {
      id: Date.now(),
      lat,
      lng,
      note,
      tags: Array.isArray(tags) ? tags : [],
      created_at: new Date().toISOString()
    };

    pins.push(newPin);
    await fs.writeJson(DATA_FILE, pins, { spaces: 2 });

    res.json(newPin);
  } catch (err) {
    console.error("Add pin failed:", err);
    res.status(500).json({ error: 'Failed to save pin' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
