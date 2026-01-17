
// -------------------- Your Drive Folder IDs --------------------
const PARENT_FOLDER_ID = '1ENN4-jiKk-O7C_nyiJUy5bFaJNobMBxS'; // folder containing images.json

// server.js
const express = require('express');
const { google } = require('googleapis');
require('dotenv').config(); // optional if using .env for SERVICE_ACCOUNT_JSON

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Google Drive Setup --------------------
const SERVICE_ACCOUNT_JSON = process.env.SERVICE_ACCOUNT_JSON;
if (!SERVICE_ACCOUNT_JSON) {
  console.error('ERROR: SERVICE_ACCOUNT_JSON not set!');
  process.exit(1);
}

const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// Folder ID of your images folder in Drive
const IMAGES_FOLDER_ID = '1r2frulcoyyAclt_kltxtN8qG9kTmt1db';


// -------------------- Serve images dynamically --------------------
app.get('/images/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log('Requesting image:', filename);

    // Find file in Drive folder
    const response = await drive.files.list({
      q: `'${IMAGES_FOLDER_ID}' in parents and name='${filename}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (!response.data.files || response.data.files.length === 0) {
      console.warn('File not found in Drive:', filename);
      return res.status(404).send('File not found');
    }

    const fileId = response.data.files[0].id;

    // Stream file from Drive
    const fileStream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    fileStream.data.pipe(res);
  } catch (err) {
    console.error('Error fetching image:', err.message);
    res.status(500).send('Error fetching image');
  }
});

// -------------------- Serve static files --------------------
app.use(express.static('public'));

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
