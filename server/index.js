const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmers');
const collectionRoutes = require('./routes/collections');
const paymentRoutes = require('./routes/payments');
const collectorRoutes = require('./routes/collectors');
const settingsRoutes = require('./routes/settings');
const logsRoutes = require('./routes/logs');
const reportsRoutes = require('./routes/reports');

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/collectors', collectorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'MilkApp backend is running.' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
