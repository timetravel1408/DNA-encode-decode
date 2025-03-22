# DNA Encoder/Decoder

A web application that encodes files into DNA sequences and decodes them back, with optional password encryption.

## Version
Current version: 1.0.2

## Features

- File to DNA sequence encoding
- DNA sequence to file decoding
- Optional password encryption
- Configurable base length and error correction
- Modern Material-UI interface
- RESTful API with FastAPI
- GenScript template compatibility
- Support for multiple file formats (images, audio, video, text, PDF)
- Secure API access with authentication
- ZIP file support for both encoding and decoding

## Documentation

For detailed information about the project, please refer to:

1. [Biological Principles](docs/BIOLOGY.md)
   - DNA structure and properties
   - DNA synthesis constraints
   - Data storage principles
   - Applications and limitations

2. [Technical Documentation](docs/TECHNICAL.md)
   - System architecture
   - Implementation details
   - Security features
   - Performance optimization

## Tech Stack

### Backend
- Python 3.9+
- FastAPI
- Pydantic
- Uvicorn
- Cryptography (Fernet)
- JWT Authentication
- Python-Jose
- Passlib

### Frontend
- React
- TypeScript
- Material-UI
- Webpack
- JSZip

## Setup

1. Clone the repository:
```bash
git clone https://github.com/timetravel1408/DNA-encode-decode.git
cd dna-encoder
```

2. Set up the backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

3. Set up the frontend:
```bash
cd frontend
npm install
npm start
```

## Usage

1. Open http://localhost:3000 in your browser
2. Log in with your API credentials
3. Upload a file to encode it into DNA sequences
4. Choose output format (GenScript template compatible)
5. Optionally provide a password for encryption
6. Choose base length and error correction level
7. Download the encoded sequences as a ZIP file
8. Use the decode section to convert DNA sequences back to the original file
   - Support for ZIP files containing multiple sequences
   - Automatic file type detection
   - Manual file type selection for specific formats

## API Documentation

The API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Contact

For questions, suggestions, or collaboration opportunities, please contact:
- Email: timetravel1408@gmail.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- DNA encoding principles based on research in molecular computing
- Error correction implementation using Reed-Solomon coding
- UI components from Material-UI
- GenScript template compatibility
