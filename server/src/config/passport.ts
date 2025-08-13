import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Try find user by Google ID
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }

    // Try find user by email to link accounts
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email found in Google profile'));
    }

    user = await User.findOne({ email });

    if (user) {
      user.googleId = profile.id;
      if (!user.providers.includes('google')) user.providers.push('google');
      user.isVerified = true; // Google email is verified
      user.avatar = user.avatar || profile.photos?.[0]?.value;
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }

    // Create new user
    user = new User({
      googleId: profile.id,
      name: profile.displayName || 'No Name',
      email,
      avatar: profile.photos?.[0]?.value,
      providers: ['google'],  
      isEmailVerified: true,
      lastLogin: new Date()
    });

    await user.save();
    done(null, user);
  } catch (error) {
    done(error as any);
  }
}));

// No session usage needed with JWT, but implement if using sessions
passport.serializeUser((user: any, done) => {
  const id = user?.id || user?._id;
  done(null, id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
