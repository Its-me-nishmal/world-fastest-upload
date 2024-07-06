const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Grid = require('gridfs-stream');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(morgan('dev'));

// Use CORS middleware with specific origin
const corsOptions = {
  origin: 'https://world-fastest-upload-1l65.vercel.app', // Replace with your front-end origin
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// MongoDB connection
const mongoURI = 'mongodb+srv://devnishmal:Nichuvdr786@nishmalsdev.hgasejj.mongodb.net/image-upload';
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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
  const { filename, contentType } = req.body; // Include contentType in the request
  console.log(`Upload complete request received for file ${filename}`);

  const writeStream = gfs.createWriteStream({
    _id: new mongoose.Types.ObjectId(),
    filename: filename,
    contentType: contentType, // Use the provided contentType
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

// Endpoint to get the file by filename
app.get('/file/:filename', (req, res) => {
  console.log(`Request received to get file ${req.params.filename}`);
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      console.error(`No file found for ${req.params.filename}`);
      return res.status(404).json({ err: 'No file exists' });
    }

    // Set appropriate content type
    res.set('Content-Type', file.contentType);
    const readstream = gfs.createReadStream(file.filename);
    readstream.pipe(res);
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
