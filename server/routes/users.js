const express = require('express');
const router = express.Router();
const { models } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/users - Fetch all users from MongoDB
router.get('/', async (req, res) => {
  try {
    const users = await models.User.find().select('-password').sort({ createdAt: -1 });
    const safeUsers = users.map(u => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt
    }));

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

    const user = await models.User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found in MongoDB.' });
    
    user.role = role;
    await user.save();

    res.json({
      message: `User ${user.name} role successfully updated to ${role.toUpperCase()} in database.`,
      user: {
        id: user._id.toString(),
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

    const user = await models.User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found in MongoDB.' });
    
    return res.json({ message: `User ${user.name} (${user.phone}) deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
