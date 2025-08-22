require('dotenv').config();
const express = require('express');
const Joi = require('joi');
const pool = require('./db');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

const schoolSchema = Joi.object({
  name: Joi.string().max(255).required(),
  address: Joi.string().max(500).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

app.get('/',(req, res) => {
  res.send('Welcome to the School Management API');
});

app.post('/addSchool', async (req, res) => {
  const { error, value } = schoolSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { name, address, latitude, longitude } = value;

  try {
    const [result] = await pool.execute(
      'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name, address, latitude, longitude]
    );
    return res.status(201).json({
      id: result.insertId,
      name,
      address,
      latitude,
      longitude
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.get('/listSchools', async (req, res) => {
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);

  if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
    return res.status(400).json({ error: 'Query params lat and lng are required and must be numbers.' });
  }

  try {
    const sql = `
      SELECT id, name, address, latitude, longitude,
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?))
          + sin(radians(?)) * sin(radians(latitude))
        )) AS distance_km
      FROM schools
      ORDER BY distance_km ASC;
    `;
    const [rows] = await pool.execute(sql, [userLat, userLng, userLat]);

    const schools = rows.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      distance_km: r.distance_km !== null ? Number(Number(r.distance_km).toFixed(3)) : null
    }));

    return res.json({ count: schools.length, schools });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = app;



