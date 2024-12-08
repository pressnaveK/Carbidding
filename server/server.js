const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2');
const Redis = require('ioredis');




const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
require('./createDatabase'); 
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST']
  }
});

const redis = new Redis({
  host: 'localhost',   
  port: 6379,           
  db: 0                
});
redis.on('connect', () => {
  console.log('Connected to Redis');
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root', 
  database: 'car_auction',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the car_auction database');
});

app.post('/login', (req, res) => {
  const { user_id, password } = req.body;

  // SQL query to find the user by user_id
  const query = 'SELECT * FROM users WHERE user_id = ?';

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error('Database query error:', err); // Log the error details
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];

    // Compare the password from the database with the input password
    if (user.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Successful login, send user_id and username as part of the response
    res.status(200).json({
      message: 'Login successful',
      userId: user.user_id,
      username: user.username, // Send username here
    });
  });
});

app.post('/auctions', (req, res) => {
  const { auction_id, car_id, start_datetime, end_datetime } = req.body;

  // Validate required fields
  if (!auction_id || !car_id || !start_datetime || !end_datetime) {
    return res.status(400).json({ message: 'auction_id, car_id, start_datetime, and end_datetime are required' });
  }

  const query = `
    INSERT INTO auctions (auction_id, car_id, start_datetime, end_datetime)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [auction_id, car_id, start_datetime, end_datetime], (err, result) => {
    if (err) {
      console.error('Error inserting auction:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(201).json({ message: 'Auction created successfully', auctionId: auction_id });
  });
});

// POST endpoint to create a new user
app.post('/users', (req, res) => {
  const { user_id, username, password } = req.body;

  // Validate the request body
  if (!user_id || !username || !password) {
    return res.status(400).json({ message: 'user_id, username, and password are required' });
  }

  const query = `
    INSERT INTO users (user_id, username, password)
    VALUES (?, ?, ?)
  `;

  db.query(query, [user_id, username, password], (err, result) => {
    if (err) {
      console.error('Error inserting user:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  });
});
app.post('/bid', (req, res) => {
  const { user_id, auction_id, bid_amount} = req.body;

  // Validate the request body
  if (!user_id || !auction_id || !bid_amount) {
    return res.status(400).json({ message: 'user_id, auction_id, bid_amount are required' });
  }

  const query = `
    INSERT INTO bids (user_id, auction_id, bid_amount) VALUES (?, ?, ?)
  `;

  db.query(query, [user_id, auction_id, bid_amount], (err, result) => {
    if (err) {
      console.error('Error inserting user:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  });
});

// Endpoint to get all auctions
app.get('/auctions', (req, res) => {
  const query = 'SELECT * FROM auctions WHERE end_datetime > NOW()';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching auctions:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results);  // Return the list of auctions
  });
});


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  //Joining to Auction
  socket.on('join_auction', (auctionID) => {
    socket.join(auctionID);
    console.log(`User ${socket.id} joined auctionID: ${auctionID}`);
  });
  //Leaving from an Auction
  socket.on('leave_auction', (auctionID) => {
    socket.leave(auctionID);
    console.log(`User ${socket.id} left auctionID: ${auctionID}`);
  });

  socket.on('place_bid', async({auctionID , user , amount }) => {
    console.log(auctionID);
    try{
      const highestBid = parseFloat(await redis.get(`auction:${auctionID}:highbid`)) || 0;
      console.log(highestBid,amount);
      if(amount > highestBid){
        console.log("implemented");
        await redis.set(`auction:${auctionID}:highbid`,amount);
        socket.to(auctionID).emit("highest_bid",amount);
        console.log("implemented");
      }
      console.log(" Not implemented");
    }catch(err){
      socket.emit("error", err );
      console.log(err);

    }

    
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});