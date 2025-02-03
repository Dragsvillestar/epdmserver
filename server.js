require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const path = require('path');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

  const sessionStore = MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI, 
    collectionName: 'sessions' 
  });
  
  // User Schema & Passport
  const loggerSchema = new mongoose.Schema({ 
    username: { type: String, required: true }, 
    password: { type: String, required: true },
    position: String,
    email: String,
    phone: String,
    address: String,
    nature: String
  });
  
  const Logger = mongoose.model("Logger", loggerSchema);
  
  // Passport Local Strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await Logger.findOne({ username: username });
      if (!user) return done(null, false, { message: 'Incorrect username.' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: 'Incorrect password.' });
  
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
  
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await Logger.findById(id);
      done(null, user); 
    } catch (err) {
      done(err); // Pass error if findById fails
    }
  });  
  
  // Session Configuration
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    store: sessionStore,
    key: 'express.sid',
    cookie: { secure: false, httpOnly: true } 
  });  

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'pug');
app.set('views', './views/pug');
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());


// Home Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  res.redirect('/profile');
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err); // If there's an error, pass it to the next middleware
    }

    if (!user) {
      return res.status(401).json({ error: info.message || 'Username or password incorrect' });
    }

    // Log the user in if authentication is successful
    req.logIn(user, (err) => {
      if (err) {
        return next(err); // If there's an error logging in, pass it to the next middleware
      }

      // Send a success response with the redirect destination
      return res.json({ redirectTo: '/profile' });
    });
  })(req, res, next);
});


app.post('/register', async (req, res) => {
  const { username, password, position, email, phone, address, nature } = req.body;
  try {
    const existingUser = await Logger.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Logger({
      username,
      password: hashedPassword,
      position,
      email,
      phone,
      address,
      nature,
    });

    await newUser.save();
    console.log('user added')
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error registering user');
  }
});


app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index2.html'));
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
