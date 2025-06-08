const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// First connect without database to create it if needed
const initialConnection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password123'
});

initialConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  
  // Create database if it doesn't exist
  initialConnection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'commissionzero_db'}`, (err) => {
    if (err) {
      console.error('Error creating database:', err);
      return;
    }
    
    // Close initial connection
    initialConnection.end();
    
    // Connect to the database
    const db = mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password123',
      database: process.env.DB_NAME || 'commissionzero_db'
    });

    db.connect((err) => {
      if (err) {
        console.error('Error connecting to database:', err);
        return;
      }
      console.log('Connected to MySQL database');
      
      // Create tables if they don't exist
      createTables(db);
    });

    // Create necessary tables
    function createTables(db) {
      // Users table
      db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          user_type ENUM('customer', 'contractor', 'freelancer') NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Service providers table
      db.query(`
        CREATE TABLE IF NOT EXISTS service_providers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          service_type VARCHAR(50) NOT NULL,
          experience INT NOT NULL,
          price_range VARCHAR(100),
          description TEXT,
          rating DECIMAL(3,2) DEFAULT 0,
          projects_completed INT DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Portfolio images table
      db.query(`
        CREATE TABLE IF NOT EXISTS portfolio_images (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider_id INT NOT NULL,
          image_url VARCHAR(255) NOT NULL,
          FOREIGN KEY (provider_id) REFERENCES service_providers(id)
        )
      `);

      // Messages table
      db.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sender_id INT NOT NULL,
          receiver_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sender_id) REFERENCES users(id),
          FOREIGN KEY (receiver_id) REFERENCES users(id)
        )
      `);

      // Calendar events table
      db.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider_id INT NOT NULL,
          customer_id INT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          status ENUM('available', 'booked', 'completed', 'cancelled') DEFAULT 'available',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES users(id),
          FOREIGN KEY (customer_id) REFERENCES users(id)
        )
      `);

      // Provider availability table
      db.query(`
        CREATE TABLE IF NOT EXISTS provider_availability (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider_id INT NOT NULL,
          day_of_week TINYINT NOT NULL, /* 0 = Sunday, 6 = Saturday */
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          FOREIGN KEY (provider_id) REFERENCES users(id)
        )
      `);
    }

    // Authentication middleware
    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) return res.status(401).json({ error: 'Access denied' });

      jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey123', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
      });
    };

    // Routes

    // Register user
    app.post('/api/register', async (req, res) => {
      try {
        const { name, email, password, userType, serviceType, experience, description } = req.body;
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        db.query(
          'INSERT INTO users (name, email, password, user_type) VALUES (?, ?, ?, ?)',
          [name, email, hashedPassword, userType],
          (err, result) => {
            if (err) {
              if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Email already exists' });
              }
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            // If user is service provider, add additional info
            if (userType !== 'customer') {
              db.query(
                'INSERT INTO service_providers (user_id, service_type, experience, description) VALUES (?, ?, ?, ?)',
                [result.insertId, serviceType, experience, description]
              );
            }
            
            res.status(201).json({ message: 'User registered successfully' });
          }
        );
      } catch (error) {
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Login
    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;
      
      db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (results.length === 0) return res.status(400).json({ error: 'User not found' });
        
        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        
        const token = jwt.sign(
          { id: user.id, email: user.email, userType: user.user_type },
          process.env.JWT_SECRET || 'mysecretkey123'
        );
        
        res.json({ token, userType: user.user_type });
      });
    });

    // Get service providers
    app.get('/api/providers/:serviceType', (req, res) => {
      const { serviceType } = req.params;
      
      db.query(
        `SELECT sp.*, u.name, u.email 
         FROM service_providers sp 
         JOIN users u ON sp.user_id = u.id 
         WHERE sp.service_type = ?`,
        [serviceType],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Server error' });
          res.json(results);
        }
      );
    });

    // Send message
    app.post('/api/messages', authenticateToken, (req, res) => {
      const { receiverId, message } = req.body;
      const senderId = req.user.id;
      
      db.query(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, message],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error sending message' });
          res.json({ message: 'Message sent successfully' });
        }
      );
    });

    // Get messages between users
    app.get('/api/messages/:otherUserId', authenticateToken, (req, res) => {
      const { otherUserId } = req.params;
      const userId = req.user.id;
      
      db.query(
        `SELECT * FROM messages 
         WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
         ORDER BY created_at ASC`,
        [userId, otherUserId, otherUserId, userId],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Error fetching messages' });
          res.json(results);
        }
      );
    });

    // Calendar Routes

    // Get provider's calendar events
    app.get('/api/calendar/:providerId', authenticateToken, (req, res) => {
      const { providerId } = req.params;
      const { start, end } = req.query;
      
      db.query(
        `SELECT ce.*, 
                u1.name as provider_name,
                u2.name as customer_name 
         FROM calendar_events ce
         LEFT JOIN users u1 ON ce.provider_id = u1.id
         LEFT JOIN users u2 ON ce.customer_id = u2.id
         WHERE ce.provider_id = ? 
         AND ce.start_time >= ? 
         AND ce.end_time <= ?`,
        [providerId, start, end],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Error fetching calendar events' });
          res.json(results);
        }
      );
    });

    // Create calendar event (for providers to set availability)
    app.post('/api/calendar', authenticateToken, (req, res) => {
      const { title, description, startTime, endTime } = req.body;
      const providerId = req.user.id;
      
      db.query(
        'INSERT INTO calendar_events (provider_id, title, description, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
        [providerId, title, description, startTime, endTime],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Error creating calendar event' });
          res.status(201).json({ message: 'Calendar event created', eventId: result.insertId });
        }
      );
    });

    // Book a time slot
    app.post('/api/calendar/book/:eventId', authenticateToken, (req, res) => {
      const { eventId } = req.params;
      const customerId = req.user.id;
      
      db.query(
        `UPDATE calendar_events 
         SET customer_id = ?, status = 'booked' 
         WHERE id = ? AND status = 'available'`,
        [customerId, eventId],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Error booking appointment' });
          if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Time slot not available' });
          }
          res.json({ message: 'Appointment booked successfully' });
        }
      );
    });

    // Set provider availability
    app.post('/api/availability', authenticateToken, (req, res) => {
      const providerId = req.user.id;
      const { availabilitySchedule } = req.body;
      
      // First delete existing availability
      db.query('DELETE FROM provider_availability WHERE provider_id = ?', [providerId], (err) => {
        if (err) return res.status(500).json({ error: 'Error updating availability' });
        
        // Insert new availability
        const values = availabilitySchedule.map(schedule => 
          [providerId, schedule.dayOfWeek, schedule.startTime, schedule.endTime]
        );
        
        db.query(
          'INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time) VALUES ?',
          [values],
          (err) => {
            if (err) return res.status(500).json({ error: 'Error setting availability' });
            res.json({ message: 'Availability updated successfully' });
          }
        );
      });
    });

    // Get provider availability
    app.get('/api/availability/:providerId', (req, res) => {
      const { providerId } = req.params;
      
      db.query(
        'SELECT * FROM provider_availability WHERE provider_id = ? ORDER BY day_of_week, start_time',
        [providerId],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Error fetching availability' });
          res.json(results);
        }
      );
    });

    // Cancel appointment
    app.post('/api/calendar/cancel/:eventId', authenticateToken, (req, res) => {
      const { eventId } = req.params;
      const userId = req.user.id;
      
      db.query(
        `UPDATE calendar_events 
         SET status = 'cancelled' 
         WHERE id = ? AND (provider_id = ? OR customer_id = ?)`,
        [eventId, userId, userId],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Error cancelling appointment' });
          if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Appointment not found or unauthorized' });
          }
          res.json({ message: 'Appointment cancelled successfully' });
        }
      );
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}); 