const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Grid = require('gridfs-stream');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors'); // Import the cors package

const app = express();
app.use(bodyParser.json());
app.use(morgan('dev')); // Use Morgan for HTTP request logging

// Use cors middleware
const corsOptions = {
  origin: 'https://world-fastest-upload-1l65.vercel.app', 
  credentials:true, // Replace with your front-end origin
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions)); // Allow access from any origin


// MongoDB connection
const mongoURI = 'mongodb+srv://devnishmal:Nichuvdr786@nishmalsdev.hgasejj.mongodb.net/image-upload';
const conn = mongoose.createConnection(mongoURI);

console.log('Connecting to MongoDB...');

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  console.log('Connected to MongoDB and GridFS initialized.');
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// In-memory storage for file chunks
const fileChunks = {};

// Endpoint to handle chunk upload
app.post('/upload-chunk', upload.single('chunk'), (req, res) => {
  const { filename, chunkIndex } = req.body;

  if (!fileChunks[filename]) {
    fileChunks[filename] = [];
  }

  fileChunks[filename][chunkIndex] = req.file.buffer;

  console.log(`Received chunk ${chunkIndex} for file ${filename}`);
  res.status(200).send('Chunk uploaded');
});

// Endpoint to handle upload completion
app.post('/upload-complete', async (req, res) => {
  const { filename } = req.body;
  console.log(`Upload complete request received for file ${filename}`);

  const writeStream = gfs.createWriteStream({
    _id: new mongoose.Types.ObjectId(),
    filename: filename,
    content_type: 'image/jpeg',
  });

  const chunks = fileChunks[filename];

  if (!chunks) {
    return res.status(400).send('No chunks found for this file');
  }

  for (const chunk of chunks) {
    writeStream.write(chunk);
  }

  writeStream.end();

  writeStream.on('finish', () => {
    console.log(`Upload complete for file ${filename}`);
    delete fileChunks[filename]; // Clear the in-memory storage for this file
    res.status(200).send('Upload complete');
  });

  writeStream.on('error', (err) => {
    console.error(`Error writing file ${filename}:`, err);
    res.status(500).json({ err });
  });
});

// Endpoint to get the image by filename
app.get('/image/:filename', (req, res) => {
  console.log(`Request received to get image ${req.params.filename}`);
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      console.error(`No file found for ${req.params.filename}`);
      return res.status(404).json({ err: 'No file exists' });
    }

    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      console.log(`Serving image ${req.params.filename}`);
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      console.error(`File ${req.params.filename} is not an image`);
      res.status(404).json({ err: 'Not an image' });
    }
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
