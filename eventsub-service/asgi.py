"""
ASGI entry point for the EventSub service.
This file initializes the asynchronous background service when the app is started.
"""

import asyncio
import logging
from main import app, background_task

logger = logging.getLogger("eventsub-service")

# This will be started by hypercorn automatically
background_task_future = None

@app.before_serving
async def startup():
    """Start the background task before the first request."""
    global background_task_future
    logger.info("Starting background task from ASGI startup")
    loop = asyncio.get_event_loop()
    background_task_future = loop.create_task(background_task())

@app.after_serving
async def shutdown():
    """Shutdown the background task when the app is stopping."""
    global background_task_future
    if background_task_future:
        logger.info("Cancelling background task from ASGI shutdown")
        background_task_future.cancel()
        try:
            await background_task_future
        except asyncio.CancelledError:
            pass 