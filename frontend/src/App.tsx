import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Button, 
  CircularProgress,
  TextField,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import axios from 'axios';
import JSZip from 'jszip';
import './App.css';

const DropzoneArea = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: theme.palette.background.default,
  border: `2px dashed ${theme.palette.primary.main}`,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const ResultBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  maxHeight: '200px',
  overflow: 'auto',
}));

const SequenceBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}));

interface EncodeResponse {
  sequences: string[];
  metadata: {
    original_size: number;
    sequence_count: number;
    base_length: number;
    error_correction: string;
    is_encrypted: boolean;
  };
  zip_file: string;
}

interface DecodeResponse {
  decoded_data: string;
  decoded_size: number;
  is_encrypted: boolean;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [baseLength, setBaseLength] = useState(200);
  const [errorCorrection, setErrorCorrection] = useState('basic');
  const [encodedData, setEncodedData] = useState<EncodeResponse | null>(null);
  const [decodedData, setDecodedData] = useState<DecodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sequences, setSequences] = useState<string[]>([]);
  const [decodedFile, setDecodedFile] = useState<Blob | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const handleEncode = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);
      formData.append('base_length', baseLength.toString());
      formData.append('error_correction', errorCorrection);

      const response = await axios.post<EncodeResponse>(
        'http://localhost:8000/encode',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setEncodedData(response.data);
      setSequences(response.data.sequences);
      setSuccess('File encoded successfully!');
    } catch (err) {
      setError('Error encoding file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = async () => {
    if (sequences.length === 0) {
      setError('Please provide DNA sequences to decode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<DecodeResponse>(
        'http://localhost:8000/decode',
        {
          sequences,
          password,
          error_correction: errorCorrection,
        }
      );

      setDecodedData(response.data);
      
      // Convert base64 to blob
      const binaryString = atob(response.data.decoded_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      setDecodedFile(new Blob([bytes]));
      
      setSuccess('File decoded successfully!');
    } catch (err) {
      setError('Error decoding file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!encodedData?.zip_file) return;

    try {
      const zip = new JSZip();
      sequences.forEach((sequence, index) => {
        zip.file(`sequence_${index}.txt`, sequence);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dna_sequences.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Error creating zip file');
      console.error(err);
    }
  };

  const handleDownloadDecoded = () => {
    if (!decodedFile) return;

    const url = window.URL.createObjectURL(decodedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decoded_file';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          DNA Data Encoder/Decoder
        </Typography>

        <Grid container spacing={3}>
          {/* Encoder Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Encode File to DNA
              </Typography>
              
              <DropzoneArea {...getRootProps()}>
                <input {...getInputProps()} />
                <Typography>
                  {isDragActive
                    ? 'Drop the file here'
                    : 'Drag and drop a file here, or click to select'}
                </Typography>
                {file && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Selected file: {file.name} ({Math.round(file.size / 1024)} KB)
                  </Typography>
                )}
              </DropzoneArea>

              <TextField
                fullWidth
                label="Password (optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Base Length</InputLabel>
                <Select
                  value={baseLength}
                  label="Base Length"
                  onChange={(e) => setBaseLength(Number(e.target.value))}
                >
                  <MenuItem value={100}>100 bases</MenuItem>
                  <MenuItem value={200}>200 bases</MenuItem>
                  <MenuItem value={500}>500 bases</MenuItem>
                  <MenuItem value={1000}>1000 bases</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Error Correction</InputLabel>
                <Select
                  value={errorCorrection}
                  label="Error Correction"
                  onChange={(e) => setErrorCorrection(e.target.value)}
                >
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                onClick={handleEncode}
                disabled={!file || loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Encode'}
              </Button>

              {encodedData && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">
                    Encoded {encodedData.metadata.sequence_count} sequences
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={handleDownloadZip}
                    sx={{ mt: 1 }}
                  >
                    Download Sequences (ZIP)
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Decoder Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Decode DNA to File
              </Typography>

              <TextField
                fullWidth
                label="DNA Sequences (one per line)"
                multiline
                rows={6}
                value={sequences.join('\n')}
                onChange={(e) => setSequences(e.target.value.split('\n').filter(s => s.trim()))}
                margin="normal"
                helperText="Enter DNA sequences (ACGT) separated by newlines"
              />

              <TextField
                fullWidth
                label="Password (if encrypted)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Error Correction</InputLabel>
                <Select
                  value={errorCorrection}
                  label="Error Correction"
                  onChange={(e) => setErrorCorrection(e.target.value)}
                >
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                onClick={handleDecode}
                disabled={sequences.length === 0 || loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Decode'}
              </Button>

              {decodedData && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">
                    Decoded size: {Math.round(decodedData.decoded_size / 1024)} KB
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={handleDownloadDecoded}
                    sx={{ mt: 1 }}
                  >
                    Download Decoded File
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Error and Success Messages */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
        >
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default App; 