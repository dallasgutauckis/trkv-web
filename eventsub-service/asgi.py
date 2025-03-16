"""
ASGI entry point for the EventSub service.
This file initializes the asynchronous background service when the app is started.
"""

import asyncio
import logging
import threading
import signal
import sys
from main import app, EventSubService, logger, service_status

# Global service instance
eventsub_service = None
background_task = None

def run_asyncio_service():
    """Run the EventSub service in an asyncio event loop in a separate thread."""
    global eventsub_service, background_task
    
    logger.info("Starting EventSub service background thread")
    
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Initialize the service
        eventsub_service = EventSubService()
        
        # Set up signal handlers in the loop
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown_service(loop)))
        
        # Initialize and run the service
        loop.run_until_complete(eventsub_service.initialize())
        service_status["status"] = "running"
        
        # Keep the service running
        while eventsub_service.keep_running:
            service_status["connected_channels"] = len(eventsub_service.channels_to_monitor)
            loop.run_until_complete(asyncio.sleep(1))
            
    except Exception as e:
        logger.error(f"Error in EventSub service: {str(e)}")
        service_status["status"] = "error"
    finally:
        if eventsub_service:
            loop.run_until_complete(eventsub_service.shutdown())
        loop.close()
        logger.info("EventSub service background thread stopped")

async def shutdown_service(loop):
    """Shutdown the service gracefully."""
    global eventsub_service
    
    logger.info("Shutting down EventSub service")
    service_status["status"] = "shutting_down"
    
    if eventsub_service:
        await eventsub_service.shutdown()
    
    # Stop the event loop
    loop.stop()

# Start the service in a background thread upon module import
service_thread = threading.Thread(target=run_asyncio_service)
service_thread.daemon = True
service_thread.start()

# This is the application entry point for Hypercorn
application = app 