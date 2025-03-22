from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
from typing import Dict, Optional, List, Any
import io
from pydantic import BaseModel, ConfigDict
from cryptography.fernet import Fernet
import hashlib
import zipfile
import struct

# Define response models
class EncodeRequest(BaseModel):
    password: Optional[str] = None
    base_length: int = 200
    error_correction: str = "basic"

class EncodeResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    sequences: List[str]
    metadata: Dict[str, Any]
    zip_file: str

class DecodeRequest(BaseModel):
    sequences: List[str]
    password: Optional[str] = None
    error_correction: str = "basic"

class DecodeResponse(BaseModel):
    decoded_data: str
    decoded_size: int
    is_encrypted: bool

class HealthResponse(BaseModel):
    status: str

def get_encryption_key(password: str) -> bytes:
    """Generate a Fernet key from the password."""
    key = hashlib.sha256(password.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_data(data: bytes, password: str) -> bytes:
    """Encrypt data using the provided password."""
    key = get_encryption_key(password)
    f = Fernet(key)
    return f.encrypt(data)

def decrypt_data(encrypted_data: bytes, password: str) -> bytes:
    """Decrypt data using the provided password."""
    key = get_encryption_key(password)
    f = Fernet(key)
    return f.decrypt(encrypted_data)

def split_into_chunks(data: bytes, chunk_size: int) -> List[bytes]:
    """Split data into chunks of specified size."""
    return [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]

def add_error_correction(chunk: bytes, index: int) -> bytes:
    """Add error correction and index to chunk."""
    # Add index (4 bytes) and error correction (2 bytes)
    index_bytes = struct.pack('>I', index)
    error_correction = struct.pack('>H', hash(chunk) & 0xFFFF)
    return index_bytes + error_correction + chunk

def verify_error_correction(chunk: bytes) -> bool:
    """Verify error correction of chunk."""
    if len(chunk) < 6:  # Need at least 6 bytes for index and error correction
        return False
    index_bytes = chunk[:4]
    error_correction = chunk[4:6]
    data = chunk[6:]
    expected_error_correction = struct.pack('>H', hash(data) & 0xFFFF)
    return error_correction == expected_error_correction

def bytes_to_dna(data: bytes) -> str:
    """Convert bytes to DNA sequence."""
    dna = ""
    for byte in data:
        # Convert each byte to a 4-base DNA sequence
        dna += "ACGT"[byte % 4]
    return dna

def dna_to_bytes(dna: str) -> bytes:
    """Convert DNA sequence back to bytes."""
    data = bytearray()
    for i in range(0, len(dna), 4):
        if i + 4 <= len(dna):
            byte = "ACGT".index(dna[i])
            data.append(byte)
    return bytes(data)

app = FastAPI(
    title="DNA Data Encoder/Decoder API",
    description="""
    This API provides endpoints for encoding files into DNA sequences and decoding DNA sequences back into files.
    
    ## Features
    * File to DNA sequence encoding with optional password encryption
    * DNA sequence to file decoding with password decryption
    * Configurable base length and error correction
    * Health check endpoint
    
    ## Usage
    1. Upload a file using the `/encode` endpoint to convert it to DNA sequences
    2. Optionally provide a password for encryption
    3. Choose base length and error correction level
    4. Use the `/decode` endpoint to convert DNA sequences back to the original file
    5. If the file was encrypted, provide the same password for decryption
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the API is running and healthy."
)
async def health_check():
    return {"status": "healthy"}

@app.post(
    "/encode",
    response_model=EncodeResponse,
    summary="Encode File to DNA",
    description="Upload a file to encode it into DNA sequences with optional password encryption."
)
async def encode_file(
    file: UploadFile = File(..., description="The file to encode into DNA sequence"),
    password: Optional[str] = Body(None, description="Optional password for encryption"),
    base_length: int = Body(200, description="Length of each DNA sequence"),
    error_correction: str = Body("basic", description="Error correction level")
) -> EncodeResponse:
    try:
        # Read file content
        content = await file.read()
        
        # Encrypt content if password is provided
        is_encrypted = False
        if password:
            content = encrypt_data(content, password)
            is_encrypted = True
        
        # Split content into chunks
        chunks = split_into_chunks(content, base_length - 6)  # Reserve 6 bytes for index and error correction
        
        # Convert chunks to DNA sequences
        sequences = []
        for i, chunk in enumerate(chunks):
            chunk_with_ec = add_error_correction(chunk, i)
            dna_sequence = bytes_to_dna(chunk_with_ec)
            sequences.append(dna_sequence)
        
        # Create metadata
        metadata = {
            "original_size": len(content),
            "sequence_count": len(sequences),
            "base_length": base_length,
            "error_correction": error_correction,
            "is_encrypted": is_encrypted
        }
        
        # Create ZIP file containing sequences
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, sequence in enumerate(sequences):
                zip_file.writestr(f'sequence_{i}.txt', sequence)
        
        # Convert ZIP to base64
        zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode('utf-8')
        
        return EncodeResponse(
            sequences=sequences,
            metadata=metadata,
            zip_file=zip_base64
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(
    "/decode",
    response_model=DecodeResponse,
    summary="Decode DNA to File",
    description="Convert DNA sequences back into the original file data with optional password decryption."
)
async def decode_data(
    data: DecodeRequest = Body(..., description="The DNA sequences to decode and optional password")
) -> DecodeResponse:
    try:
        if not data.sequences:
            raise HTTPException(status_code=400, detail="No sequences provided")
        
        # Convert DNA sequences back to bytes
        chunks = []
        for sequence in data.sequences:
            chunk = dna_to_bytes(sequence)
            if not verify_error_correction(chunk):
                raise HTTPException(status_code=400, detail="Error correction failed")
            chunks.append(chunk[6:])  # Remove index and error correction
        
        # Combine chunks
        content = b''.join(chunks)
        
        # Decrypt content if password is provided
        is_encrypted = False
        if data.password:
            try:
                content = decrypt_data(content, data.password)
                is_encrypted = True
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid password or corrupted data")
        
        # Convert to base64
        decoded_content = base64.b64encode(content).decode('utf-8')
        
        return DecodeResponse(
            decoded_data=decoded_content,
            decoded_size=len(content),
            is_encrypted=is_encrypted
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 