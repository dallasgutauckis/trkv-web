#!/bin/bash

# Kill any process using port 3000
kill_port() {
    lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
}

# Kill existing processes
echo "Checking for existing processes on port 3000..."
kill_port

# Start the development server
echo "Starting development server on port 3000..."
npm run dev -- -p 3000 