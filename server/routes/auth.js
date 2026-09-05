const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models } = require('../db');
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

    const existing = await models.User.findOne({
      $or: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanPhone ? [{ phone: cleanPhone }] : [])
      ]
    });

    if (existing) {
      return res.status(400).json({ error: 'A user with this email or phone already exists in database.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await models.User.create({
      name: name.trim(),
      ...(cleanEmail ? { email: cleanEmail } : {}),
      phone: cleanPhone,
      password: hashedPassword,
      role: 'viewer', // ALWAYS default role is viewer
      status: 'Active'
    });

    const userId = createdUser._id.toString();
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

    const user = await models.User.findOne({
      $or: [
        { email: cleanId },
        { phone: cleanId },
        ...(cleanDigits.length >= 7 ? [{ phone: { $regex: cleanDigits, $options: 'i' } }] : []),
        { name: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User account not found in database.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact an administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const userId = user._id.toString();
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

// Reset Password by Username, Phone Number, or Email
router.post('/reset-password', async (req, res) => {
  try {
    const { identifier, phone, email, newPassword } = req.body;
    const lookupId = (identifier || phone || email || '').toString().trim();

    if (!lookupId || !newPassword) {
      return res.status(400).json({ error: 'Please provide your registered username, phone, or email and new password.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const cleanId = lookupId.toLowerCase();
    const cleanDigits = lookupId.replace(/\D/g, '');
    const escapedName = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const queryOr = [
      { email: cleanId },
      { phone: lookupId },
      { name: { $regex: new RegExp(`^${escapedName}$`, 'i') } }
    ];

    if (cleanDigits.length >= 6) {
      queryOr.push({ phone: { $regex: cleanDigits, $options: 'i' } });
    }

    const user = await models.User.findOne({ $or: queryOr });

    if (!user) {
      return res.status(404).json({ error: 'No user account found matching the provided username, phone, or email.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

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
