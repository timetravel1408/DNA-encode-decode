import React, { useState, useCallback } from 'react';
import { Container, Box, Typography, Paper, Button, CircularProgress, IconButton, Tooltip, Alert, TextField, LinearProgress } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoIcon from '@mui/icons-material/Info';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import './App.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BACKEND_URL = 'http://localhost:8000';

const App: React.FC = () => {
  const [encodedData, setEncodedData] = useState<string>('');
  const [decodedData, setDecodedData] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [pasteMode, setPasteMode] = useState<boolean>(false);
  const [acceptedFiles, setAcceptedFiles] = useState<File[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError('');
    setIsLoading(true);
    setCopySuccess(false);
    setPasteMode(false);
    const file = acceptedFiles[0];
    setAcceptedFiles(acceptedFiles);
    setFileName(file.name);
    setFileType(file.type || 'Unknown type');

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending file to backend:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      const response = await axios.post(`${BACKEND_URL}/encode`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total!) * 100;
          setUploadProgress(progress);
        },
      });

      console.log('Backend response:', response.data);

      if (response.data && response.data.encoded_data) {
        setEncodedData(response.data.encoded_data);
        setDecodedData('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error details:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          setError(`Server error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
        } else if (error.request) {
          // The request was made but no response was received
          setError('No response from server. Please check if the backend is running.');
        } else {
          // Something happened in setting up the request that triggered an Error
          setError(`Request error: ${error.message}`);
        }
      } else {
        setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    maxSize: MAX_FILE_SIZE,
    multiple: false
  });

  const handleDecode = async () => {
    setError('');
    setIsLoading(true);
    setCopySuccess(false);
    try {
      const response = await axios.post(`${BACKEND_URL}/decode`, {
        encoded_data: encodedData,
      });
      setDecodedData(response.data.decoded_data);
    } catch (error) {
      console.error('Decode error:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          setError(`Server error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
        } else if (error.request) {
          setError('No response from server. Please check if the backend is running.');
        } else {
          setError(`Request error: ${error.message}`);
        }
      } else {
        setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handlePaste = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEncodedData(event.target.value);
    setPasteMode(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 6 }}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom 
          align="center"
          sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(45deg, #2196f3 30%, #21CBF3 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 4
          }}
        >
          DNA Data Encoder/Decoder
        </Typography>

        <Alert 
          severity="info" 
          icon={<InfoIcon />} 
          sx={{ mb: 3 }}
        >
          Upload a file to encode it into DNA sequence or paste encoded DNA data to decode it back to the original file.
          Maximum file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
        </Alert>
        
        <Paper
          {...getRootProps()}
          className="dropzone"
          sx={{
            backgroundColor: isDragActive ? 'rgba(33, 150, 243, 0.08)' : 'rgba(255, 255, 255, 0.9)',
            position: 'relative',
          }}
        >
          <input {...getInputProps()} />
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
              <CircularProgress />
              <Typography>Processing...</Typography>
              {uploadProgress > 0 && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    {Math.round(uploadProgress)}% uploaded
                  </Typography>
                </Box>
              )}
            </Box>
          ) : isDragActive ? (
            <Typography variant="h6" sx={{ color: 'primary.main' }}>
              Drop the file here...
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <FileUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                Drag and drop a file here, or click to select a file
              </Typography>
            </Box>
          )}
        </Paper>

        {fileName && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Selected file: {fileName} ({fileType}) - {formatFileSize(acceptedFiles[0]?.size || 0)}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {!pasteMode && !encodedData && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setPasteMode(true)}
              sx={{ mt: 2 }}
            >
              Or paste encoded data directly
            </Button>
          </Box>
        )}

        {pasteMode && !encodedData && (
          <Box className="data-display">
            <Typography variant="h6" color="primary" gutterBottom>
              Paste Encoded Data:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              placeholder="Paste your encoded DNA data here..."
              value={encodedData}
              onChange={handlePaste}
              sx={{ mt: 2 }}
            />
          </Box>
        )}

        {encodedData && (
          <Box className="data-display">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary">
                Encoded Data:
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton 
                  onClick={() => handleCopy(encodedData)}
                  className={`copy-button ${copySuccess ? 'success' : ''}`}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography className="monospace-text">
              {encodedData}
            </Typography>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDecode}
                disabled={isLoading}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Decode Data'}
              </Button>
            </Box>
          </Box>
        )}

        {decodedData && (
          <Box className="data-display">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary">
                Decoded Data:
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton 
                  onClick={() => handleCopy(decodedData)}
                  className={`copy-button ${copySuccess ? 'success' : ''}`}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography className="monospace-text">
              {decodedData}
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default App; 