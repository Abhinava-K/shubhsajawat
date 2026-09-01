const express = require('express');
const router = express.Router();
const { db, isMongoConnected, models } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/users - Fetch all users from MongoDB
router.get('/', async (req, res) => {
  try {
    let safeUsers;
    if (isMongoConnected()) {
      const users = await models.User.find().select('-password').sort({ createdAt: -1 });
      safeUsers = users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt
      }));
    } else {
      safeUsers = db.data.users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt
      }));
    }

    res.json({ users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users from database.' });
  }
});

// PATCH /api/admin/users/:id/role - Promote/Upgrade user role in MongoDB
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'loader', 'viewer'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (admin, loader, viewer).' });
    }

    let user;
    if (isMongoConnected()) {
      user = await models.User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found in MongoDB.' });
      user.role = role;
      await user.save();
    } else {
      user = db.data.users.find(u => u.id === req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      user.role = role;
      db.save();
    }

    res.json({
      message: `User ${user.name} role successfully updated to ${role.toUpperCase()} in database.`,
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// DELETE /api/admin/users/:id - Delete a user (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    if (isMongoConnected()) {
      const user = await models.User.findByIdAndDelete(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found in MongoDB.' });
      return res.json({ message: `User ${user.name} (${user.phone}) deleted successfully.` });
    }

    const idx = db.data.users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found.' });
    const removed = db.data.users.splice(idx, 1)[0];
    db.save();

    res.json({ message: `User ${removed.name} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
