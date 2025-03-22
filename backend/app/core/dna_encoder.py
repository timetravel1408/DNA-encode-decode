from typing import List, Tuple, Optional
import numpy as np
from reedsolo import RSCodec
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Random import get_random_bytes
import base64

class DNAEncoder:
    """Core DNA encoding engine that handles conversion of data to DNA sequences."""
    
    NUCLEOTIDES = ['A', 'T', 'C', 'G']
    MAX_HOMOPOLYMER_LENGTH = 3
    TARGET_GC_CONTENT = 0.5
    GC_CONTENT_TOLERANCE = 0.1

    def __init__(self, base_length: int = 200, error_correction_level: str = "basic"):
        """
        Initialize the DNA encoder with specific parameters.
        
        Args:
            base_length: Length of each DNA sequence
            error_correction_level: Level of error correction ("none", "basic", "robust")
        """
        self.base_length = base_length
        self.error_correction_level = error_correction_level
        
        # Initialize Reed-Solomon error correction
        if error_correction_level == "none":
            self.ecc_symbols = 0
        elif error_correction_level == "basic":
            self.ecc_symbols = 8
        else:  # robust
            self.ecc_symbols = 16
            
        if self.ecc_symbols > 0:
            self.rs_codec = RSCodec(self.ecc_symbols)

    def _binary_to_dna(self, binary_data: bytes) -> str:
        """Convert binary data to DNA sequence using 2-bit encoding."""
        result = []
        for byte in binary_data:
            # Process each byte (8 bits) into 4 nucleotides (2 bits each)
            for i in range(0, 8, 2):
                bits = (byte >> (6 - i)) & 0b11
                result.append(self.NUCLEOTIDES[bits])
        return ''.join(result)

    def _optimize_gc_content(self, sequence: str) -> str:
        """Optimize GC content while maintaining data integrity."""
        gc_content = (sequence.count('G') + sequence.count('C')) / len(sequence)
        
        if abs(gc_content - self.TARGET_GC_CONTENT) <= self.GC_CONTENT_TOLERANCE:
            return sequence
            
        # Simple optimization: swap some A/T with G/C or vice versa
        sequence_list = list(sequence)
        if gc_content < self.TARGET_GC_CONTENT:
            # Replace some A/T with G/C
            for i in range(len(sequence_list)):
                if sequence_list[i] in ['A', 'T']:
                    sequence_list[i] = 'G' if np.random.random() < 0.5 else 'C'
                    gc_content = (sequence_list.count('G') + sequence_list.count('C')) / len(sequence_list)
                    if abs(gc_content - self.TARGET_GC_CONTENT) <= self.GC_CONTENT_TOLERANCE:
                        break
        else:
            # Replace some G/C with A/T
            for i in range(len(sequence_list)):
                if sequence_list[i] in ['G', 'C']:
                    sequence_list[i] = 'A' if np.random.random() < 0.5 else 'T'
                    gc_content = (sequence_list.count('G') + sequence_list.count('C')) / len(sequence_list)
                    if abs(gc_content - self.TARGET_GC_CONTENT) <= self.GC_CONTENT_TOLERANCE:
                        break
                        
        return ''.join(sequence_list)

    def _avoid_homopolymers(self, sequence: str) -> str:
        """Modify sequence to avoid long runs of the same nucleotide."""
        result = list(sequence)
        i = 0
        while i < len(result) - self.MAX_HOMOPOLYMER_LENGTH:
            window = result[i:i + self.MAX_HOMOPOLYMER_LENGTH + 1]
            if len(set(window)) == 1:  # All nucleotides in window are the same
                alternatives = [n for n in self.NUCLEOTIDES if n != window[0]]
                result[i + self.MAX_HOMOPOLYMER_LENGTH] = np.random.choice(alternatives)
            i += 1
        return ''.join(result)

    def _encrypt_data(self, data: bytes, password: str) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-256 with password-based key derivation."""
        salt = get_random_bytes(16)
        key = PBKDF2(password.encode(), salt, dkLen=32, count=100000)
        cipher = AES.new(key, AES.MODE_GCM)
        ciphertext, tag = cipher.encrypt_and_digest(data)
        return ciphertext, cipher.nonce, salt

    def _add_fragment_id(self, sequence: str, fragment_id: int) -> str:
        """Add a fragment identifier to the sequence."""
        id_binary = format(fragment_id, '016b')
        id_dna = self._binary_to_dna(int(id_binary, 2).to_bytes(2, byteorder='big'))
        return id_dna + sequence

    def encode(self, data: bytes, password: Optional[str] = None) -> List[str]:
        """
        Encode binary data into DNA sequences.
        
        Args:
            data: Binary data to encode
            password: Optional password for encryption
            
        Returns:
            List of DNA sequences
        """
        if password:
            data, nonce, salt = self._encrypt_data(data, password)
            # Prepend encryption metadata to data
            data = salt + nonce + data

        # Calculate how many nucleotides we can fit in each sequence
        usable_length = self.base_length - 8  # Reserve 8 nucleotides for fragment ID
        bytes_per_sequence = (usable_length * 2) // 8  # 2 bits per nucleotide

        # Split data into chunks
        sequences = []
        for i in range(0, len(data), bytes_per_sequence):
            chunk = data[i:i + bytes_per_sequence]
            
            # Convert to DNA sequence
            dna_sequence = self._binary_to_dna(chunk)
            
            # Apply error correction if enabled
            if self.ecc_symbols > 0:
                dna_sequence = self._binary_to_dna(self.rs_codec.encode(chunk))
            
            # Optimize sequence
            dna_sequence = self._optimize_gc_content(dna_sequence)
            dna_sequence = self._avoid_homopolymers(dna_sequence)
            
            # Add fragment ID
            dna_sequence = self._add_fragment_id(dna_sequence, len(sequences))
            
            sequences.append(dna_sequence)
            
        return sequences

    def _dna_to_binary(self, dna_sequence: str) -> bytes:
        """Convert DNA sequence back to binary data."""
        result = bytearray()
        current_byte = 0
        bit_count = 0
        
        for nucleotide in dna_sequence:
            bits = self.NUCLEOTIDES.index(nucleotide)
            current_byte = (current_byte << 2) | bits
            bit_count += 2
            
            if bit_count == 8:
                result.append(current_byte)
                current_byte = 0
                bit_count = 0
                
        return bytes(result)

    def decode(self, sequences: List[str], password: Optional[str] = None) -> bytes:
        """
        Decode DNA sequences back to binary data.
        
        Args:
            sequences: List of DNA sequences
            password: Optional password for decryption
            
        Returns:
            Original binary data
        """
        # Sort sequences by fragment ID
        def extract_fragment_id(seq):
            id_dna = seq[:8]
            id_binary = self._dna_to_binary(id_dna)
            return int.from_bytes(id_binary, byteorder='big')
            
        sequences = sorted(sequences, key=extract_fragment_id)
        
        # Remove fragment IDs and concatenate data
        data = bytearray()
        for sequence in sequences:
            sequence = sequence[8:]  # Remove fragment ID
            chunk = self._dna_to_binary(sequence)
            
            # Apply error correction if enabled
            if self.ecc_symbols > 0:
                try:
                    chunk = self.rs_codec.decode(chunk)[0]
                except:
                    raise ValueError(f"Error correction failed for sequence")
                    
            data.extend(chunk)
            
        if password:
            # Extract encryption metadata
            salt = data[:16]
            nonce = data[16:32]
            ciphertext = data[32:]
            
            # Decrypt data
            key = PBKDF2(password.encode(), salt, dkLen=32, count=100000)
            cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
            try:
                data = cipher.decrypt(ciphertext)
            except:
                raise ValueError("Decryption failed - incorrect password")
                
        return bytes(data) 