import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import JSZip from 'jszip';
import Login from './components/Login';

const FILE_TYPES = [
  { value: 'image/*', label: 'Image Files' },
  { value: 'audio/*', label: 'Audio Files' },
  { value: 'video/*', label: 'Video Files' },
  { value: 'text/plain', label: 'Text Files' },
  { value: 'application/pdf', label: 'PDF Files' },
  { value: 'application/zip', label: 'ZIP Files' },
];

const TEMPLATE_FORMATS = [
  { value: 'genscript', label: 'GenScript Template' },
  { value: 'standard', label: 'Standard Format' },
];

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [baseLength, setBaseLength] = useState(100);
  const [errorCorrection, setErrorCorrection] = useState(1);
  const [templateFormat, setTemplateFormat] = useState('genscript');
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]);
      setError('');
      setSuccess('');
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'video/*': ['.mp4', '.avi', '.mov'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
    },
  });

  const handleEncode = async () => {
    if (!file) {
      setError('Please select a file to encode');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);
      formData.append('base_length', baseLength.toString());
      formData.append('error_correction', errorCorrection.toString());
      formData.append('template_format', templateFormat);

      const response = await axios.post('http://localhost:8000/encode', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Create ZIP file with sequences in GenScript format
      const zip = new JSZip();
      response.data.sequences.forEach((sequence: string, index: number) => {
        const filename = `sequence_${index + 1}.txt`;
        const content = templateFormat === 'genscript'
          ? `>${file.name}_${index + 1}\n${sequence}`
          : sequence;
        zip.file(filename, content);
      });

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name}_sequences.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('File encoded successfully!');
    } catch (err) {
      setError('Error encoding file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = async () => {
    if (!file) {
      setError('Please select a file to decode');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);
      formData.append('file_type', fileType);
      formData.append('template_format', templateFormat);

      const response = await axios.post('http://localhost:8000/decode', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const blob = new Blob([response.data.data], { type: response.data.content_type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decoded_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('File decoded successfully!');
    } catch (err) {
      setError('Error decoding file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          DNA Encoder/Decoder
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Paper
          {...getRootProps()}
          sx={{
            p: 3,
            mb: 3,
            textAlign: 'center',
            backgroundColor: isDragActive ? '#f0f0f0' : 'white',
            cursor: 'pointer',
          }}
        >
          <input {...getInputProps()} />
          <Typography>
            {file ? file.name : 'Drag and drop a file here, or click to select'}
          </Typography>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Password (optional)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Base Length"
              type="number"
              value={baseLength}
              onChange={(e) => setBaseLength(Number(e.target.value))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Error Correction Level"
              type="number"
              value={errorCorrection}
              onChange={(e) => setErrorCorrection(Number(e.target.value))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Template Format"
              value={templateFormat}
              onChange={(e) => setTemplateFormat(e.target.value)}
            >
              {TEMPLATE_FORMATS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="File Type (for decoding)"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
            >
              <MenuItem value="">Auto-detect</MenuItem>
              {FILE_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleEncode}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Encode'}
            </Button>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleDecode}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Decode'}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default App; 