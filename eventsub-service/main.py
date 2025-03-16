#!/usr/bin/env python3
"""
Twitch EventSub Monitoring Service

This service connects to Twitch's EventSub WebSocket API to monitor channel point redemptions
and other events. It's designed to be resilient, automatically reconnect, and notify channels
when it comes online or when VIP status is granted.
"""

import os
import json
import time
import uuid
import logging
import asyncio
import signal
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set

import aiohttp
import websockets
import backoff
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv
from google.cloud import firestore
from google.cloud import logging as gcp_logging

# Load environment variables
load_dotenv()

# Configure logging
logging_client = gcp_logging.Client()
logging_client.setup_logging()

logger = logging.getLogger("eventsub-service")
logger.setLevel(logging.INFO)

# Constants
TWITCH_API_BASE = "https://api.twitch.tv/helix"
EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws"
RECONNECT_TIMEOUT = 5  # seconds
MAX_RECONNECT_ATTEMPTS = 10
HEARTBEAT_INTERVAL = 10  # seconds
SESSION_ID = str(uuid.uuid4())

# Environment variables
TWITCH_CLIENT_ID = os.getenv("TWITCH_CLIENT_ID")
TWITCH_CLIENT_SECRET = os.getenv("TWITCH_CLIENT_SECRET")
PROJECT_ID = os.getenv("PROJECT_ID")
API_BASE_URL = os.getenv("API_BASE_URL")

# Global state
active_connections = {}
monitored_channels = set()
app_access_token = None
token_expiry = 0
db = None

class EventSubService:
    def __init__(self):
        self.db = firestore.Client()
        self.session_id = str(uuid.uuid4())
        self.ws = None
        self.keep_running = True
        self.reconnect_attempts = 0
        self.active_subscriptions = set()
        self.channels_to_monitor = set()
        self.heartbeat_task = None
        self.token_refresh_task = None
        self.app_access_token = None
        self.token_expiry = 0
        self.session = None
        
    async def initialize(self):
        """Initialize the service and connect to Twitch EventSub."""
        logger.info(f"Initializing EventSub service with session ID: {self.session_id}")
        
        # Create aiohttp session
        self.session = aiohttp.ClientSession()
        
        # Get app access token
        await self.get_app_access_token()
        
        # Load channels to monitor
        await self.load_channels_to_monitor()
        
        # Start token refresh task
        self.token_refresh_task = asyncio.create_task(self.refresh_token_periodically())
        
        # Connect to EventSub
        await self.connect_to_eventsub()
        
        # Notify channels that service is online
        await self.notify_channels_service_online()
        
    async def get_app_access_token(self):
        """Get an app access token from Twitch."""
        if not TWITCH_CLIENT_ID or not TWITCH_CLIENT_SECRET:
            raise ValueError("Twitch client ID and secret must be set")
        
        logger.info("Getting app access token")
        
        try:
            async with self.session.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": TWITCH_CLIENT_ID,
                    "client_secret": TWITCH_CLIENT_SECRET,
                    "grant_type": "client_credentials"
                }
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Failed to get app access token: {error_text}")
                    raise Exception(f"Failed to get app access token: {response.status}")
                
                data = await response.json()
                self.app_access_token = data["access_token"]
                # Set expiry to 90% of the actual expiry time to be safe
                self.token_expiry = time.time() + (data["expires_in"] * 0.9)
                logger.info("Successfully obtained app access token")
        except Exception as e:
            logger.error(f"Error getting app access token: {str(e)}")
            raise
    
    async def refresh_token_periodically(self):
        """Periodically refresh the app access token."""
        while self.keep_running:
            # Sleep until token is close to expiry
            time_until_refresh = max(0, self.token_expiry - time.time() - 60)
            await asyncio.sleep(time_until_refresh)
            
            if self.keep_running:
                try:
                    await self.get_app_access_token()
                except Exception as e:
                    logger.error(f"Failed to refresh token: {str(e)}")
                    # Sleep a bit before retrying
                    await asyncio.sleep(30)
    
    async def load_channels_to_monitor(self):
        """Load channels to monitor from Firestore."""
        logger.info("Loading channels to monitor")
        
        try:
            # Get all active channel point rewards
            rewards_ref = self.db.collection("channelPointRewards")
            rewards = rewards_ref.where("isEnabled", "==", True).stream()
            
            for reward in rewards:
                reward_data = reward.to_dict()
                channel_id = reward_data.get("channelId")
                if channel_id:
                    self.channels_to_monitor.add(channel_id)
                    logger.info(f"Added channel to monitor: {channel_id}")
            
            logger.info(f"Loaded {len(self.channels_to_monitor)} channels to monitor")
        except Exception as e:
            logger.error(f"Error loading channels to monitor: {str(e)}")
            raise
    
    @backoff.on_exception(
        backoff.expo,
        (websockets.exceptions.ConnectionClosed, 
         websockets.exceptions.ConnectionClosedError,
         websockets.exceptions.ConnectionClosedOK),
        max_tries=MAX_RECONNECT_ATTEMPTS
    )
    async def connect_to_eventsub(self):
        """Connect to Twitch EventSub WebSocket API."""
        logger.info("Connecting to Twitch EventSub WebSocket API")
        
        try:
            async with websockets.connect(EVENTSUB_WS_URL) as websocket:
                self.ws = websocket
                self.reconnect_attempts = 0
                
                # Start heartbeat task
                self.heartbeat_task = asyncio.create_task(self.send_heartbeat())
                
                # Process messages
                await self.process_messages()
        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            self.ws = None
            
            if self.heartbeat_task:
                self.heartbeat_task.cancel()
                self.heartbeat_task = None
            
            self.reconnect_attempts += 1
            if self.reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
                logger.error("Max reconnect attempts reached, giving up")
                self.keep_running = False
                raise
            
            logger.info(f"Reconnecting in {RECONNECT_TIMEOUT} seconds (attempt {self.reconnect_attempts})")
            await asyncio.sleep(RECONNECT_TIMEOUT)
            await self.connect_to_eventsub()
    
    async def process_messages(self):
        """Process messages from the EventSub WebSocket."""
        if not self.ws:
            logger.error("WebSocket connection not established")
            return
        
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    message_type = data.get("metadata", {}).get("message_type")
                    
                    if message_type == "session_welcome":
                        await self.handle_welcome(data)
                    elif message_type == "notification":
                        await self.handle_notification(data)
                    elif message_type == "session_keepalive":
                        logger.debug("Received keepalive")
                    elif message_type == "session_reconnect":
                        await self.handle_reconnect(data)
                    elif message_type == "revocation":
                        await self.handle_revocation(data)
                    else:
                        logger.warning(f"Unknown message type: {message_type}")
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse message: {message}")
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"WebSocket connection closed: {str(e)}")
            raise
    
    async def handle_welcome(self, data):
        """Handle welcome message from EventSub."""
        session_id = data.get("payload", {}).get("session", {}).get("id")
        logger.info(f"Connected to EventSub with session ID: {session_id}")
        
        # Create subscriptions for all monitored channels
        for channel_id in self.channels_to_monitor:
            await self.create_channel_subscriptions(channel_id, session_id)
    
    async def create_channel_subscriptions(self, channel_id, session_id):
        """Create EventSub subscriptions for a channel."""
        logger.info(f"Creating subscriptions for channel {channel_id}")
        
        # Subscription for channel point redemptions
        await self.create_subscription(
            "channel.channel_points_custom_reward_redemption.add",
            {
                "broadcaster_user_id": channel_id
            },
            session_id
        )
        
        # Subscription for VIP add events
        await self.create_subscription(
            "channel.vip.add",
            {
                "broadcaster_user_id": channel_id
            },
            session_id
        )
        
        # Subscription for VIP remove events
        await self.create_subscription(
            "channel.vip.remove",
            {
                "broadcaster_user_id": channel_id
            },
            session_id
        )
    
    async def create_subscription(self, subscription_type, condition, session_id):
        """Create an EventSub subscription."""
        logger.info(f"Creating subscription for {subscription_type}")
        
        try:
            headers = {
                "Client-ID": TWITCH_CLIENT_ID,
                "Authorization": f"Bearer {self.app_access_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "type": subscription_type,
                "version": "1",
                "condition": condition,
                "transport": {
                    "method": "websocket",
                    "session_id": session_id
                }
            }
            
            async with self.session.post(
                f"{TWITCH_API_BASE}/eventsub/subscriptions",
                headers=headers,
                json=data
            ) as response:
                if response.status != 202:
                    error_text = await response.text()
                    logger.error(f"Failed to create subscription: {error_text}")
                    return False
                
                response_data = await response.json()
                subscription_id = response_data.get("data", [{}])[0].get("id")
                if subscription_id:
                    self.active_subscriptions.add(subscription_id)
                    logger.info(f"Created subscription {subscription_id} for {subscription_type}")
                    return True
                else:
                    logger.error(f"Failed to get subscription ID from response: {response_data}")
                    return False
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            return False
    
    async def handle_notification(self, data):
        """Handle notification from EventSub."""
        try:
            subscription_type = data.get("metadata", {}).get("subscription_type")
            event_data = data.get("payload", {}).get("event", {})
            
            logger.info(f"Received notification for {subscription_type}")
            
            if subscription_type == "channel.channel_points_custom_reward_redemption.add":
                await self.handle_redemption(event_data)
            elif subscription_type == "channel.vip.add":
                await self.handle_vip_add(event_data)
            elif subscription_type == "channel.vip.remove":
                await self.handle_vip_remove(event_data)
        except Exception as e:
            logger.error(f"Error handling notification: {str(e)}")
    
    async def handle_redemption(self, event_data):
        """Handle channel point redemption event."""
        try:
            broadcaster_id = event_data.get("broadcaster_user_id")
            user_id = event_data.get("user_id")
            user_name = event_data.get("user_name")
            reward_id = event_data.get("reward", {}).get("id")
            reward_title = event_data.get("reward", {}).get("title")
            redemption_id = event_data.get("id")
            
            logger.info(f"Channel point redemption: {user_name} redeemed {reward_title} in channel {broadcaster_id}")
            
            # Check if this reward is for VIP status
            reward_ref = self.db.collection("channelPointRewards").where("rewardId", "==", reward_id).limit(1).stream()
            reward_docs = list(reward_ref)
            
            if not reward_docs:
                logger.info(f"Reward {reward_id} not found in database, ignoring")
                return
            
            # Process the redemption by calling the API
            await self.process_vip_redemption(broadcaster_id, user_id, user_name, reward_id, reward_title, redemption_id)
        except Exception as e:
            logger.error(f"Error handling redemption: {str(e)}")
    
    async def process_vip_redemption(self, broadcaster_id, user_id, user_name, reward_id, reward_title, redemption_id):
        """Process a VIP redemption by calling the API."""
        try:
            # Get user tokens
            user_doc = await self.get_user_document(broadcaster_id)
            if not user_doc:
                logger.error(f"User document not found for broadcaster {broadcaster_id}")
                return
            
            user_data = user_doc.to_dict()
            access_token = user_data.get("tokens", {}).get("accessToken")
            
            if not access_token:
                logger.error(f"Access token not found for broadcaster {broadcaster_id}")
                return
            
            # Call the API to grant VIP status
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "channelId": broadcaster_id,
                "userId": user_id,
                "username": user_name,
                "grantedBy": broadcaster_id,
                "grantMethod": "channelPoints",
                "metadata": {
                    "rewardId": reward_id,
                    "rewardTitle": reward_title,
                    "redemptionId": redemption_id
                }
            }
            
            async with self.session.post(
                f"{API_BASE_URL}/api/vip",
                headers=headers,
                json=data
            ) as response:
                response_data = await response.json()
                
                if response.status == 200 and response_data.get("success"):
                    logger.info(f"Successfully granted VIP status to {user_name} in channel {broadcaster_id}")
                    
                    # Notify the channel
                    await self.notify_channel_vip_granted(broadcaster_id, user_name, reward_title)
                else:
                    error = response_data.get("error", "Unknown error")
                    logger.error(f"Failed to grant VIP status: {error}")
        except Exception as e:
            logger.error(f"Error processing VIP redemption: {str(e)}")
    
    async def get_user_document(self, user_id):
        """Get a user document from Firestore."""
        try:
            user_ref = self.db.collection("users").document(user_id)
            user_doc = user_ref.get()
            return user_doc if user_doc.exists else None
        except Exception as e:
            logger.error(f"Error getting user document: {str(e)}")
            return None
    
    async def handle_vip_add(self, event_data):
        """Handle VIP add event."""
        broadcaster_id = event_data.get("broadcaster_user_id")
        user_id = event_data.get("user_id")
        user_name = event_data.get("user_name")
        
        logger.info(f"VIP added: {user_name} in channel {broadcaster_id}")
    
    async def handle_vip_remove(self, event_data):
        """Handle VIP remove event."""
        broadcaster_id = event_data.get("broadcaster_user_id")
        user_id = event_data.get("user_id")
        user_name = event_data.get("user_name")
        
        logger.info(f"VIP removed: {user_name} from channel {broadcaster_id}")
    
    async def handle_reconnect(self, data):
        """Handle reconnect message from EventSub."""
        new_url = data.get("payload", {}).get("session", {}).get("reconnect_url")
        logger.info(f"Received reconnect request to {new_url}")
        
        # Close current connection
        if self.ws:
            await self.ws.close()
            self.ws = None
        
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            self.heartbeat_task = None
        
        # Connect to new URL
        try:
            async with websockets.connect(new_url) as websocket:
                self.ws = websocket
                self.reconnect_attempts = 0
                
                # Start heartbeat task
                self.heartbeat_task = asyncio.create_task(self.send_heartbeat())
                
                # Process messages
                await self.process_messages()
        except Exception as e:
            logger.error(f"Reconnect error: {str(e)}")
            # Fall back to normal connection
            await self.connect_to_eventsub()
    
    async def handle_revocation(self, data):
        """Handle revocation message from EventSub."""
        subscription_id = data.get("payload", {}).get("subscription", {}).get("id")
        status = data.get("payload", {}).get("subscription", {}).get("status")
        
        logger.warning(f"Subscription {subscription_id} revoked with status {status}")
        
        if subscription_id in self.active_subscriptions:
            self.active_subscriptions.remove(subscription_id)
    
    async def send_heartbeat(self):
        """Send periodic heartbeats to keep the connection alive."""
        while self.ws and self.keep_running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                if self.ws and self.ws.open:
                    logger.debug("Sending heartbeat")
                    # No need to send actual data, just check if connection is alive
                    pong = await self.ws.ping()
                    await asyncio.wait_for(pong, timeout=5)
            except asyncio.TimeoutError:
                logger.warning("Heartbeat timeout, reconnecting")
                if self.ws:
                    await self.ws.close()
                    self.ws = None
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {str(e)}")
                break
    
    async def notify_channels_service_online(self):
        """Notify all monitored channels that the service is online."""
        logger.info("Notifying channels that service is online")
        
        for channel_id in self.channels_to_monitor:
            await self.notify_channel_service_online(channel_id)
    
    async def notify_channel_service_online(self, channel_id):
        """Notify a channel that the service is online."""
        try:
            # Get broadcaster's username
            user_doc = await self.get_user_document(channel_id)
            if not user_doc:
                logger.error(f"User document not found for broadcaster {channel_id}")
                return
            
            user_data = user_doc.to_dict()
            username = user_data.get("username", "broadcaster")
            
            # Send chat message
            headers = {
                "Client-ID": TWITCH_CLIENT_ID,
                "Authorization": f"Bearer {self.app_access_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "broadcaster_id": channel_id,
                "message": f"VIP Manager Bot is now online and monitoring channel point redemptions! Session ID: {self.session_id[:8]}"
            }
            
            async with self.session.post(
                f"{TWITCH_API_BASE}/chat/announcements",
                headers=headers,
                json=data
            ) as response:
                if response.status != 204:
                    error_text = await response.text()
                    logger.error(f"Failed to send online notification to channel {username}: {error_text}")
                else:
                    logger.info(f"Sent online notification to channel {username}")
        except Exception as e:
            logger.error(f"Error notifying channel {channel_id}: {str(e)}")
    
    async def notify_channel_vip_granted(self, channel_id, user_name, reward_title):
        """Notify a channel that VIP status was granted."""
        try:
            # Get broadcaster's username
            user_doc = await self.get_user_document(channel_id)
            if not user_doc:
                logger.error(f"User document not found for broadcaster {channel_id}")
                return
            
            user_data = user_doc.to_dict()
            broadcaster_name = user_data.get("username", "broadcaster")
            
            # Send chat message
            headers = {
                "Client-ID": TWITCH_CLIENT_ID,
                "Authorization": f"Bearer {self.app_access_token}",
                "Content-Type": "application/json"
            }
            
            data = {
                "broadcaster_id": channel_id,
                "message": f"{user_name} has been granted VIP status by redeeming {reward_title}!"
            }
            
            async with self.session.post(
                f"{TWITCH_API_BASE}/chat/announcements",
                headers=headers,
                json=data
            ) as response:
                if response.status != 204:
                    error_text = await response.text()
                    logger.error(f"Failed to send VIP notification to channel {broadcaster_name}: {error_text}")
                else:
                    logger.info(f"Sent VIP notification to channel {broadcaster_name}")
        except Exception as e:
            logger.error(f"Error notifying channel {channel_id} about VIP grant: {str(e)}")
    
    async def shutdown(self):
        """Shutdown the service gracefully."""
        logger.info("Shutting down EventSub service")
        
        self.keep_running = False
        
        # Cancel tasks
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        
        if self.token_refresh_task:
            self.token_refresh_task.cancel()
        
        # Close WebSocket connection
        if self.ws:
            await self.ws.close()
        
        # Close aiohttp session
        if self.session:
            await self.session.close()
        
        logger.info("EventSub service shutdown complete")

async def main():
    """Main entry point for the service."""
    service = EventSubService()
    
    # Set up signal handlers
    loop = asyncio.get_running_loop()
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown(service)))
    
    try:
        await service.initialize()
        
        # Keep the service running
        while service.keep_running:
            await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"Service error: {str(e)}")
    finally:
        await service.shutdown()

async def shutdown(service):
    """Shutdown the service gracefully."""
    logger.info("Received shutdown signal")
    await service.shutdown()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        sys.exit(1) 