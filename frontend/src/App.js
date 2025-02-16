import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0); // State to track upload progress
  const [uploadedFileUrl, setUploadedFileUrl] = useState(''); // State to store the uploaded file URL

  const CHUNK_SIZE = 256 * 1024; // 256KB per chunk
  const MAX_PARALLEL_UPLOADS = 4; // Number of parallel uploads

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    if (file) {
      uploadFileInChunks(file);
    }
  };

  const uploadFileInChunks = async (file) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let chunkIndex = 0;
    let activeUploads = 0;

    const contentType = file.type; // Get the file type

    const uploadChunk = async (index) => {
      if (index >= totalChunks) return;

      const start = index * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('filename', file.name);
      formData.append('chunkIndex', index);
      formData.append('totalChunks', totalChunks);

      try {
        await axios.post('https://world-fastest-upload.vercel.app/upload-chunk', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true, // Include credentials in the request
        });
        
        // Update upload progress
        setUploadProgress(((index + 1) / totalChunks) * 100);
      } catch (error) {
        console.error(`Error uploading chunk ${index}:`, error);
        // Retry the chunk upload
        await uploadChunk(index);
      } finally {
        activeUploads--;
        // Start the next chunk upload if there are more chunks
        if (chunkIndex < totalChunks) {
          uploadChunk(chunkIndex++);
          activeUploads++;
        }
      }
    };

    // Start initial parallel uploads
    while (activeUploads < MAX_PARALLEL_UPLOADS && chunkIndex < totalChunks) {
      uploadChunk(chunkIndex++);
      activeUploads++;
    }

    // Wait for all uploads to complete
    while (activeUploads > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Notify the server that all chunks have been uploaded
    await axios.post('https://world-fastest-upload.vercel.app/upload-complete', {
      filename: file.name,
      contentType: contentType, // Include contentType in the request
    });

    // Set the uploaded file URL
    setUploadedFileUrl(`https://world-fastest-upload.vercel.app/file/${file.name}`);
  };

  return (
    <div className="App">
      <input type="file" onChange={handleFileChange} />
      {selectedFile && <p>Upload Progress: {uploadProgress.toFixed(2)}%</p>}
      {uploadedFileUrl && (
        <p>
          File uploaded! Access it <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer">here</a>.
        </p>
      )}
    </div>
  );
}

export default App;
