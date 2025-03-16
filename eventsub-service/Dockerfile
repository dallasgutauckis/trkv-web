FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Make the start script executable
RUN chmod +x start.sh

# Expose the port
EXPOSE 8080

# Run the service with the start script
CMD ["./start.sh"] 