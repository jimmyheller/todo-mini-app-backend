import express from 'express';

const router = express.Router();

// Mock data (replace with database operations later)
let users = [
  { id: '1', name: 'John Doe', streaks: 5, tokens: 100 }
];

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// POST /api/users
router.post('/', (req, res) => {
  const newUser = {
    id: (users.length + 1).toString(),
    name: req.body.name,
    streaks: 0,
    tokens: 0
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...req.body };
    res.json(users[userIndex]);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

export default router;