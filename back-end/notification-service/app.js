const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('redis');

// Create a Redis client (for redis v4.x)
const redisClient = createClient({
    host: 'localhost',  // Adjust this if Redis is not on localhost
    port: 6379          // Default port
});

redisClient.connect().then(() => {
  console.log('Connected to Redis');
}).catch(err => {
  console.error('Redis connection error:', err);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5002;
const CACHE_EXPIRATION = 10 * 5; // 5 minutes TTL for caching

// Middleware to parse incoming JSON requests
app.use(express.json());

// Store connected clients
let clients = [];

// WebSocket connection event
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Add client to list
  clients.push(ws);

  // WebSocket disconnection event
  ws.on('close', () => {
    console.log('Client disconnected');
    clients = clients.filter(client => client !== ws);
  });

  // Listening for messages from the client
  ws.on('message', (message) => {
    console.log(`Received: ${message}`);
  });
});

// Notify all clients (to be used when a beat is uploaded)
const notifyAllClients = (message) => {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Function to cache notifications
const cacheNotification = async (key, notification) => {
  try {
    // Store notification with a TTL (expiration time)
    await redisClient.setEx(key, CACHE_EXPIRATION, notification);
    console.log(`Notification cached with key: ${key}`);
  } catch (err) {
    console.error('Error caching notification:', err);
  }
};

// Function to check cache
const getCachedNotification = async (key) => {
  try {
    const cachedNotification = await redisClient.get(key);
    if (cachedNotification) {
      console.log(`Cache hit for key: ${key}`);
    }
    return cachedNotification;
  } catch (err) {
    console.error('Error fetching from cache:', err);
    return null;
  }
};

// Expose an endpoint to log "Notification received" and store in Redis cache
app.post('/notify-login', async (req, res) => {
    const notificationMessage = 'Login Succesful';
    const cacheKey = 'notify-login';

    // Check if the notification is already cached
    const cachedNotification = await getCachedNotification(cacheKey);
    if (cachedNotification) {
        return res.status(200).json({ message: `Cached: ${cachedNotification}` });
    }

    // Optionally notify connected WebSocket clients
    notifyAllClients(notificationMessage);

    // Cache the notification
    await cacheNotification(cacheKey, notificationMessage);

    res.status(200).json({ message: 'Login notification received and cached successfully.' });
});

app.post('/notify-signup', async (req, res) => {
    const notificationMessage = 'Signup Succesful';
    const cacheKey = 'notify-signup';

    // Check if the notification is already cached
    const cachedNotification = await getCachedNotification(cacheKey);
    if (cachedNotification) {
        return res.status(200).json({ message: `Cached: ${cachedNotification}` });
    }

    // Optionally notify connected WebSocket clients
    notifyAllClients(notificationMessage);

    // Cache the notification
    await cacheNotification(cacheKey, notificationMessage);

    res.status(200).json({ message: 'Signup notification received and cached successfully.' });
});

app.post('/notify-upload', async (req, res) => {
    const notificationMessage = 'Beat was uploaded successfully';
    const cacheKey = 'notify-upload';

    // Check if the notification is already cached
    const cachedNotification = await getCachedNotification(cacheKey);
    if (cachedNotification) {
        return res.status(200).json({ message: `Cached: ${cachedNotification}` });
    }

    // Optionally notify connected WebSocket clients
    notifyAllClients(notificationMessage);

    // Cache the notification
    await cacheNotification(cacheKey, notificationMessage);

    res.status(200).json({ message: 'Upload notification received and cached successfully.' });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Notifications service running on port ${PORT}`);
});
