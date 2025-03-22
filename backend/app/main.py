from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from typing import Dict, Optional, List, Any
import io
from pydantic import BaseModel, ConfigDict
from cryptography.fernet import Fernet
import hashlib
import zipfile
import struct
from datetime import timedelta
import mimetypes
from .auth import (
    Token, User, create_access_token, get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, verify_password, get_user
)

# Define response models
class EncodeRequest(BaseModel):
    password: Optional[str] = None
    base_length: int = 100
    error_correction: int = 1
    template_format: str = "genscript"  # New field for template format

class EncodeResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    sequences: List[str]
    metadata: dict
    template_format: str

class DecodeRequest(BaseModel):
    password: Optional[str] = None
    file_type: Optional[str] = None  # New field for file type
    template_format: str = "genscript"  # New field for template format

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
    title="DNA Encoder/Decoder API",
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
    version="1.0.2",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the API is running and healthy."
)
async def health_check():
    return {"status": "healthy", "version": "1.0.2"}

@app.post(
    "/encode",
    response_model=EncodeResponse,
    summary="Encode File to DNA",
    description="Upload a file to encode it into DNA sequences with optional password encryption."
)
async def encode_file(
    file: UploadFile = File(..., description="The file to encode into DNA sequence"),
    request: EncodeRequest = None,
    current_user: User = Depends(get_current_user)
) -> EncodeResponse:
    try:
        content = await file.read()
        
        # Encrypt content if password is provided
        is_encrypted = False
        if request.password:
            content = encrypt_data(content, request.password)
            is_encrypted = True
        
        # Split content into chunks
        chunks = split_into_chunks(content, request.base_length - 6)  # Reserve 6 bytes for index and error correction
        
        # Convert chunks to DNA sequences
        sequences = []
        for i, chunk in enumerate(chunks):
            chunk_with_ec = add_error_correction(chunk, i)
            dna_sequence = bytes_to_dna(chunk_with_ec)
            sequences.append(dna_sequence)
        
        # Create metadata
        metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "sequence_count": len(sequences),
            "base_length": request.base_length,
            "error_correction": request.error_correction,
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
            template_format=request.template_format,
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
async def decode_file(
    file: UploadFile = File(..., description="The DNA sequences to decode and optional password"),
    request: DecodeRequest = None,
    current_user: User = Depends(get_current_user)
) -> DecodeResponse:
    try:
        content = await file.read()
        
        # Handle ZIP files
        if file.filename.endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(content)) as zip_file:
                # Process multiple sequences from ZIP
                sequences = []
                for zip_info in zip_file.filelist:
                    if zip_info.filename.endswith('.txt'):
                        sequences.append(zip_file.read(zip_info.filename).decode())
        else:
            sequences = [content.decode()]

        # Convert DNA sequences back to bytes
        chunks = []
        for sequence in sequences:
            chunk = dna_to_bytes(sequence)
            if not verify_error_correction(chunk):
                raise HTTPException(status_code=400, detail="Error correction failed")
            chunks.append(chunk[6:])  # Remove index and error correction
        
        # Combine chunks
        content = b''.join(chunks)
        
        # Decrypt content if password is provided
        is_encrypted = False
        if request.password:
            try:
                content = decrypt_data(content, request.password)
                is_encrypted = True
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid password or corrupted data")
        
        # Convert to base64
        decoded_content = base64.b64encode(content).decode('utf-8')
        
        # Determine content type
        content_type = request.file_type or mimetypes.guess_type(file.filename)[0]
        
        return DecodeResponse(
            decoded_data=decoded_content,
            decoded_size=len(content),
            is_encrypted=is_encrypted
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 