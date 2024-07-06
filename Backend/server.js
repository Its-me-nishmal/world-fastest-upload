const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const { GridFSBucket } = require('mongodb');

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
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 50000,
});

const conn = mongoose.connection;

conn.once('open', () => {
  console.log('Connected to MongoDB');
});

// Initialize GridFSBucket
let gfsBucket;
conn.once('open', () => {
  gfsBucket = new GridFSBucket(conn.db, {
    bucketName: 'uploads',
  });
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

  const chunks = fileChunks[filename];

  if (!chunks) {
    return res.status(400).send('No chunks found for this file');
  }

  const uploadStream = gfsBucket.openUploadStream(filename, {
    contentType: contentType, // Use the provided contentType
  });

  for (const chunk of chunks) {
    uploadStream.write(chunk);
  }

  uploadStream.end();

  uploadStream.on('finish', () => {
    console.log(`Upload complete for file ${filename}`);
    delete fileChunks[filename]; // Clear the in-memory storage for this file
    res.status(200).send('Upload complete');
  });

  uploadStream.on('error', (err) => {
    console.error(`Error writing file ${filename}:`, err);
    res.status(500).json({ err });
  });
});

// Endpoint to get the file by filename
app.get('/file/:filename', (req, res) => {
  console.log(`Request received to get file ${req.params.filename}`);
  gfsBucket.find({ filename: req.params.filename }).toArray((err, files) => {
    if (!files || files.length === 0) {
      console.error(`No file found for ${req.params.filename}`);
      return res.status(404).json({ err: 'No file exists' });
    }

    const file = files[0];
    // Set appropriate content type
    res.set('Content-Type', file.contentType);
    const readstream = gfsBucket.openDownloadStreamByName(req.params.filename);
    readstream.pipe(res);
  });
});

// Endpoint to clear all GridFS data
app.get('/clear-gridfs', async (req, res) => {
  try {
    const files = await gfsBucket.find().toArray();
    for (const file of files) {
      await gfsBucket.delete(file._id);
    }

    console.log('All GridFS data cleared.');
    res.status(200).send('All GridFS data cleared');
  } catch (error) {
    console.error('Error clearing GridFS data:', error);
    res.status(500).send('Error clearing GridFS data');
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
