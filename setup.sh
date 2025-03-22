#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up DNA Encoder/Decoder project...${NC}"

# Create virtual environment for backend
echo -e "${GREEN}Setting up backend environment...${NC}"
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Kill any existing uvicorn processes
pkill -f uvicorn

# Start backend server in background
echo -e "${GREEN}Starting backend server...${NC}"
uvicorn app.main:app --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Setup frontend
echo -e "${GREEN}Setting up frontend environment...${NC}"
cd ../frontend
npm install

# Kill any existing node processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start frontend server in background
echo -e "${GREEN}Starting frontend server...${NC}"
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 2

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}Backend is running at: http://localhost:8000${NC}"
echo -e "${GREEN}Frontend is running at: http://localhost:3000${NC}"
echo -e "${GREEN}API documentation is available at: http://localhost:8000/docs${NC}"
echo -e "\n${GREEN}To stop the servers, press Ctrl+C${NC}"

# Keep the script running and handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait 