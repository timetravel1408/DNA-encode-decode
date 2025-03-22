from setuptools import setup, find_packages

setup(
    name="dna-encoder-backend",
    version="1.0.2",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.115.11",
        "uvicorn==0.34.0",
        "python-multipart==0.0.20",
        "pydantic==2.6.1",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4"
    ],
    author="timetravel1408",
    author_email="timetravel1408@gmail.com",
    description="DNA Encoder/Decoder Backend Service",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/timetravel1408/DNA-encode-decode",
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.9",
) 