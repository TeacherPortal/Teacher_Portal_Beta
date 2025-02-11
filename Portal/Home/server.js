const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
// Middleware setup
app.use(cookieParser());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB connection
mongoose
  .connect('mongodb+srv://amrita:amma123@amrita.gavaw.mongodb.net/combined_portal', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Mongoose Schemas and Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
});

const imageSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  data: Buffer,
  contentType: String,
});

const bookingSchema = new mongoose.Schema({
  venue: String,
  date: String,
  startTime: String,
  endTime: String,
  message: String,
  userEmail: { type: String, required: true },
  bookingTime: { type: Date, default: Date.now },
});

const classformcreSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  courseCode: { type: String, required: true },
  instructor: { type: String, required: true },
  day: { type: String, required: true },
  slots: [
    {
      slot: String,
      time: String,
      status: String,
    },
  ],
  location: { type: String, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
});

const classBookerEaseSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  courseCode: { type: String, required: true },
  instructor: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: Date, required: true },
  day: { type: String, required: true },
  slots: [
    {
      slot: String,
      time: String,
      status: String,
    },
  ],
  description: { type: String },
  createdAt: { type: Date, default: Date.now } // Auto timestamps
});
const LocationSchema = new mongoose.Schema({
  location: { type: String, required: true, unique: true },
  floor: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);
const Image = mongoose.model('Image', imageSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const ClassFormCre = mongoose.model('ClassFormCre', classformcreSchema);
const classbookering = mongoose.model("ClassBookerEase", classBookerEaseSchema);
const locationrefere = mongoose.model('Location', LocationSchema);
// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to convert time to HH:MM AM/PM format
function convertTo12HourFormat(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hour);
  date.setMinutes(minute);

  const options = { hour: '2-digit', minute: '2-digit', hour12: true };
  return date.toLocaleTimeString([], options); // Returns time in HH:MM AM/PM
}

// Middleware to check authentication
function authenticate(req, res, next) {
  const { userName, userEmail } = req.cookies;
  if (!userName || !userEmail) return res.redirect('/');
  next();
}

// Routes

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'LoginPage.html'));
});

// User login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.redirect('/?error=Username does not exist. Please try again.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.cookie('userName', user.name, { maxAge: 3600000, path: '/' });
      res.cookie('userEmail', user.email, { maxAge: 3600000, path: '/' });
      res.redirect('/homepage');
    } else {
      res.redirect('/?error=Incorrect password. Please try again.');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.redirect('/?error=Internal Server Error. Please try again later.');
  }
});

// Homepage route
app.get('/homepage', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Booking page route
app.get('/booking', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'Booking.html'));
});

app.get('/forall', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'forall.html'));
});

// Submit booking route
app.post('/submit-booking', authenticate, async (req, res) => {
  const { venue, date, startTime, endTime, message } = req.body;
  const userEmail = req.cookies.userEmail;

  try {
    // Convert start and end times to HH:MM AM/PM format
    const formattedStartTime = convertTo12HourFormat(startTime);
    const formattedEndTime = convertTo12HourFormat(endTime);

    // Manually handle the time zone conversion to avoid any UTC issues.
    const startDateTime = new Date(`${date}T${startTime}:00`); // Use local time for comparison
    const endDateTime = new Date(`${date}T${endTime}:00`); // Use local time for comparison

    console.log('Start DateTime:', startDateTime); // Add logging for debugging
    console.log('End DateTime:', endDateTime); // Add logging for debugging

    // Check if the generated startDateTime and endDateTime are valid
    if (isNaN(startDateTime) || isNaN(endDateTime)) {
      return res.status(400).send('Invalid date or time format.');
    }

    // Check for conflicting bookings in the same venue and time slot
    const conflictingBooking = await Booking.findOne({
      venue,
      date,
      $or: [
        {
          $and: [
            { startTime: { $lt: endDateTime } },
            { endTime: { $gt: startDateTime } },
          ],
        },
      ],
    });

    if (conflictingBooking) return res.status(400).send('Conflict: This slot is already booked!');

    // Save new booking to the database
    const newBooking = new Booking({
      venue,
      date,
      startTime: formattedStartTime, // Store it as a string in HH:MM AM/PM format
      endTime: formattedEndTime, // Store it as a string in HH:MM AM/PM format
      message,
      userEmail,
    });

    await newBooking.save();
    res.status(200).send('Booking successfully saved!');
  } catch (error) {
    console.error('Error saving booking:', error);
    res.status(500).send('Failed to save booking.');
  }
});

// Random quote API route
const quotes = [
  { content: "Love is our true essence. This love should be awakened in every person.", author: "Sri Mata Amritanandamayi Devi" },
  { content: "Compassion is the language the deaf can hear and the blind can see.", author: "Sri Mata Amritanandamayi Devi" },
  { content: "The first step in spiritual life is to have the darshan of your own true self.", author: "Sri Mata Amritanandamayi Devi" },
  { content: "In this universe, everything has a purpose. The invisible intelligence behind everything is what we call God.", author: "Sri Mata Amritanandamayi Devi" },
  { content: "Happiness depends on how we react to external circumstances.", author: "Sri Mata Amritanandamayi Devi" }
];

app.get('/api/quote', (req, res) => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  res.json(quotes[randomIndex]);
});

// Get bookings API route
app.get('/api/bookings', authenticate, async (req, res) => {
  const { venue, start, end } = req.query;

  try {
    const query = {};

    // Add venue filter if provided
    if (venue && venue !== 'all') {
      query.venue = venue;
    }

    // Add date range filter if start and end are provided
    if (start && end) {
      query.date = { $gte: new Date(start), $lte: new Date(end) };
    }

    // Fetch bookings based on filters
    const bookings = await Booking.find(query);
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// API to get filtered bookings by venue and date
app.get('/api/filtered-bookings', authenticate, async (req, res) => {
  const { venue, date } = req.query;

  try {
    const query = {};

    // Apply venue filter if provided
    if (venue && venue !== 'all') {
      query.venue = venue;
    }

    // Apply date filter if provided (match by date only, ignoring time part)
    if (date) {
      query.date = date; // Direct match on 'date' field in the database
    }

    const bookings = await Booking.find(query).select('venue date startTime endTime message -_id');

    // Return the bookings exactly as they are in the database
    const formattedBookings = bookings.map(booking => ({
      ...booking.toObject(), // Convert Mongoose document to plain object
    }));

    res.json({ bookings: formattedBookings });
  } catch (error) {
    console.error('Error fetching filtered bookings:', error);
    res.status(500).json({ error: 'Failed to fetch filtered bookings' });
  }
});

// Image upload route
app.post('/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!req.file) return res.status(400).send('No file uploaded.');
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(req.file.mimetype))
      return res.status(400).send('Invalid file type. Only JPEG, PNG, and GIF are allowed.');
    if (req.file.size > 5 * 1024 * 1024) return res.status(400).send('File size exceeds 5MB.');

    const existingImage = await Image.findOne({ name });
    if (existingImage) return res.status(400).send('Name already exists.');

    const newImage = new Image({ name, data: req.file.buffer, contentType: req.file.mimetype });
    await newImage.save();
    res.status(200).send('Image uploaded successfully!');
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).send('An error occurred. Please try again.');
  }
});

// Get image by name API route
app.get('/api/image', async (req, res) => {
  const { name } = req.query;
  try {
    const image = await Image.findOne({ name });
    if (!image) return res.status(404).json({ error: 'Image not found' });

    res.set('Content-Type', image.contentType);
    res.send(image.data);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Route to serve classformcre.html
app.get('/classformcre', (req, res) => {
  res.sendFile(path.join(__dirname, 'classformcre.html'));
});
// Route to serve obldkook.html
app.get('/classbookerease', (req, res) => {
  res.sendFile(path.join(__dirname, 'obldkook.html'));
});
// Route to serve finaldisplayer.html
app.get('/finalinch', (req, res) => {
  res.sendFile(path.join(__dirname, 'finaldisplayer.html'));
});
// Route to serve locationbooker.html
app.get('/locationbooker', (req, res) => {
  res.sendFile(path.join(__dirname, 'locationbooker.html'));
});
app.post("/add-class", async (req, res) => {
  try {
    const { courseName, courseCode, instructor, day, slots, location, description } = req.body;

    // Check if slot is already taken for that day AND location
    const existingClass = await ClassFormCre.findOne({ day, location, "slots.slot": slots[0].slot });

    if (existingClass) {
      return res.status(400).json({ message: "Error: Slot already exists for this day and location!" });
    }

    // Save new class (allowing same courseCode, but different location/slot/day)
    const newClass = new ClassFormCre({
      courseName,
      courseCode,  // ✅ No unique constraint on courseCode now
      instructor,
      day,
      slots,
      location,
      description
    });

    await newClass.save();
    res.json({ message: "Class added successfully!" });

  } catch (error) {
    console.error("🔥 Error saving class:", error);
    res.status(500).json({ message: "Error saving class", error: error.message });
  }
});


app.get("/get-permanent-slots", async (req, res) => {
  try {
    const { day, location } = req.query;
    if (!day || !location) {
      return res.status(400).json({ message: "Day and Location are required" });
    }

    // Find all permanent slots on the given day and location
    const takenSlots = await ClassFormCre.find({ day, location, "slots.status": "permanent" })
      .select("slots.slot");

    // Flatten results into an array of occupied slot numbers
    const occupiedSlots = takenSlots.flatMap(cls => cls.slots.map(slot => slot.slot));

    res.json(occupiedSlots);
  } catch (error) {
    res.status(500).json({ message: "Error fetching permanent slots", error });
  }
});
// 📌 **Updated: Endpoint to Fetch Booked Slots by Location & Date**
app.get("/get-booked-slots", async (req, res) => {
  try {
    const { date, location } = req.query;

    if (!date || !location) {
      return res.status(400).json({ message: "Date and location are required!" });
    }

    // Convert date to the format stored in MongoDB
    const formattedDate = new Date(date).toISOString().split("T")[0];

    // Find bookings matching the given date and location
    const bookedClasses = await classbookering.find({
      location,
      date: { $gte: new Date(formattedDate), $lt: new Date(formattedDate + "T23:59:59.999Z") },
    });

    // Extract booked slots
    let bookedSlots = [];
    bookedClasses.forEach((classBooking) => {
      classBooking.slots.forEach((slot) => {
        bookedSlots.push(slot.slot);
      });
    });

    res.json(bookedSlots);
  } catch (error) {
    console.error("🔥 Error fetching booked slots:", error);
    res.status(500).json({ message: "Error fetching booked slots", error: error.message });
  }
});
// 📌 **Updated: Endpoint to Add a Class Booking**
app.post("/add-classbookerease", async (req, res) => {
  try {
    const { courseName, courseCode, instructor, location, date, day, slots, description } = req.body;

    const formattedDate = new Date(date).toISOString().split("T")[0];

    const newBooking = new classbookering({
      courseName,
      courseCode,
      instructor,
      location,
      date: formattedDate,
      day,
      slots,
      description,
    });

    await newBooking.save();
    res.json({ message: "Class booked successfully!" });
  } catch (error) {
    console.error("🔥 Error saving class booking:", error);
    res.status(500).json({ message: "Error saving class booking", error: error.message });
  }
});// ➤ Add a new location
app.post('/add-location', async (req, res) => {
  try {
    const { location, floor } = req.body;
    if (!location || !floor) {
      return res.status(400).json({ error: 'Location and Floor are required' });
    }
    const newLocation = new locationrefere({ location, floor });
    await newLocation.save();
    res.status(201).json({ message: 'Location added successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This location already exists' });
    }
    res.status(500).json({ error: 'Error adding location' });
  }
});

// ➤ Remove a location
app.post('/remove-location', async (req, res) => {
  try {
    const { location, floor } = req.body;
    if (!location || !floor) {
      return res.status(400).json({ error: 'Location and Floor are required' });
    }
    const result = await locationrefere.findOneAndDelete({ location, floor });
    if (result) {
      res.json({ message: 'Location deleted successfully' });
    } else {
      res.status(404).json({ error: 'Location not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error deleting location' });
  }
});

// ➤ Fetch all locations and floors
app.get('/get-locations', async (req, res) => {
  try {
    const locations = await locationrefere.find();
    const locationArray = locations.map(item => item.location);
    const floorArray = locations.map(item => item.floor);
    res.json({ locations: locationArray, floors: floorArray });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching locations' });
  }
});
app.get("/get-available-locations", async (req, res) => {
  try {
    const { date, slot } = req.query;

    if (!date || !slot) {
      return res.status(400).json({ message: "Date and slot are required!" });
    }

    // Convert date to the correct format
    const formattedDate = new Date(date).toISOString().split("T")[0];

    // Get all booked locations for the given date and slot
    const bookedClasses = await classbookering.find({
      date: { $gte: new Date(formattedDate), $lt: new Date(formattedDate + "T23:59:59.999Z") },
      "slots.slot": slot,
    }).select("location");

    // Extract booked locations
    const bookedLocations = bookedClasses.map((cls) => cls.location);

    // Get all locations
    const allLocations = await locationrefere.find().select("location");
    const locationArray = allLocations.map((item) => item.location);

    // Filter available locations
    const availableLocations = locationArray.filter(loc => !bookedLocations.includes(loc));

    res.json({ availableLocations });
  } catch (error) {
    console.error("🔥 Error fetching available locations:", error);
    res.status(500).json({ message: "Error fetching available locations", error: error.message });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));