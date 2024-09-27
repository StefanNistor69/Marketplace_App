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

// Expose an endpoint to just log "Notification received" and store it in Redis
app.post('/notify-upload', async (req, res) => {
    // Simply print a static message
    const notificationMessage = 'Notification received';
    console.log(notificationMessage);
    
    // Optionally notify connected WebSocket clients
    notifyAllClients(notificationMessage);

    // Store the notification in Redis (using a list)
    const timestamp = new Date().toISOString();
    try {
        const result = await redisClient.lPush('notifications', `${timestamp}: ${notificationMessage}`);
        console.log(`Notification stored in Redis. Redis list length: ${result}`);
        res.status(200).json({ message: 'Notification received and stored successfully.' });
    } catch (err) {
        console.error('Error storing notification in Redis:', err);
        res.status(500).json({ error: 'Failed to store notification' });
    }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Notifications service running on port ${PORT}`);
});
