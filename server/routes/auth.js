const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, isMongoConnected, models } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// Register new user - STRICTLY defaults to role: "viewer"
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({ error: 'Name, password, and at least email or phone are required.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    let existing;
    if (isMongoConnected()) {
      existing = await models.User.findOne({
        $or: [
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(cleanPhone ? [{ phone: cleanPhone }] : [])
        ]
      });
    } else {
      existing = db.data.users.find(u => 
        (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) || 
        (cleanPhone && u.phone && u.phone === cleanPhone)
      );
    }

    if (existing) {
      return res.status(400).json({ error: 'A user with this email or phone already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;
    let createdUser;

    if (isMongoConnected()) {
      createdUser = await models.User.create({
        name: name.trim(),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        phone: cleanPhone,
        password: hashedPassword,
        role: 'viewer', // ALWAYS default role is viewer
        status: 'Active'
      });
      userId = createdUser._id.toString();
    } else {
      userId = "usr-" + Date.now().toString().slice(-6);
      createdUser = {
        id: userId,
        name: name.trim(),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        phone: cleanPhone,
        password: hashedPassword,
        role: 'viewer', // ALWAYS default role is viewer
        status: 'Active',
        createdAt: new Date().toISOString()
      };
      db.data.users.push(createdUser);
      db.save();
    }

    const token = jwt.sign({ id: userId, role: 'viewer' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Account created successfully with View-Only access. An administrator can upgrade you to a Loader in MongoDB or via Admin Panel.',
      token,
      user: {
        id: userId,
        name: createdUser.name,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your username, phone, or email and password.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/\D/g, '');
    let user;

    if (isMongoConnected()) {
      user = await models.User.findOne({
        $or: [
          { email: cleanId },
          { phone: cleanId },
          ...(cleanDigits.length >= 7 ? [{ phone: { $regex: cleanDigits, $options: 'i' } }] : []),
          { name: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
        ]
      });
    } else {
      user = db.data.users.find(u => 
        (u.email && u.email.toLowerCase() === cleanId) || 
        (u.phone && u.phone.toLowerCase() === cleanId) ||
        (cleanDigits.length >= 7 && u.phone && u.phone.replace(/\D/g, '') === cleanDigits) ||
        (u.name && u.name.toLowerCase() === cleanId)
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User account not found.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact an administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const userId = user._id ? user._id.toString() : user.id;
    const token = jwt.sign({ id: userId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Reset Password by Phone Number
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ error: 'Registered phone number and new password are required.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const cleanPhone = phone.trim();
    const cleanDigits = phone.replace(/\D/g, '');
    let user;

    if (isMongoConnected()) {
      user = await models.User.findOne({
        $or: [
          { phone: cleanPhone },
          ...(cleanDigits.length >= 7 ? [{ phone: { $regex: cleanDigits, $options: 'i' } }] : [])
        ]
      });
    } else {
      user = db.data.users.find(u => 
        (u.phone && u.phone === cleanPhone) ||
        (cleanDigits.length >= 7 && u.phone && u.phone.replace(/\D/g, '') === cleanDigits)
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this phone number.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    if (isMongoConnected()) {
      await user.save();
    } else {
      db.save();
    }

    res.json({ message: `Password reset successfully for ${user.name}. You can now sign in with your new password.` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error while resetting password.' });
  }
});

// Get current logged-in user profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
