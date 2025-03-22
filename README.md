# DNA Encoder/Decoder

A web application that encodes files into DNA sequences and decodes them back, with optional password encryption.

## Features

- File to DNA sequence encoding
- DNA sequence to file decoding
- Optional password encryption
- Configurable base length and error correction
- Modern Material-UI interface
- RESTful API with FastAPI

## Tech Stack

### Backend
- Python 3.9+
- FastAPI
- Pydantic
- Uvicorn
- Cryptography (Fernet)

### Frontend
- React
- TypeScript
- Material-UI
- Webpack
- JSZip

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
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
2. Upload a file to encode it into DNA sequences
3. Optionally provide a password for encryption
4. Choose base length and error correction level
5. Download the encoded sequences as a ZIP file
6. Use the decode section to convert DNA sequences back to the original file

## API Documentation

The API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## License

MIT License 