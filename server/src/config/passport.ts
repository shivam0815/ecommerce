// src/config/passport-google.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_REDIRECT_URI ||
  process.env.GOOGLE_CALLBACK_URL ||
  'http://localhost:5000/api/auth/google/callback'; // dev fallback

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: GOOGLE_CALLBACK_URL, // <-- absolute, not relative
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }

      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email found in Google profile'));

      user = await User.findOne({ email });
      if (user) {
        user.googleId = profile.id;
        if (!user.providers.includes('google')) user.providers.push('google');
        // pick ONE field name and use it consistently:
        user.isVerified = true; // or user.isVerified if that's your schema
        user.avatar = user.avatar || profile.photos?.[0]?.value;
        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }

      user = new User({
        googleId: profile.id,
        name: profile.displayName || 'No Name',
        email,
        avatar: profile.photos?.[0]?.value,
        providers: ['google'],
        isEmailVerified: true,
        lastLogin: new Date(),
      });

      await user.save();
      done(null, user);
    } catch (err) {
      done(err as any);
    }
  }
));

// sessions optional:
passport.serializeUser((user: any, done) => done(null, user?.id || user?._id));
passport.deserializeUser(async (id: string, done) => {
  try { done(null, await User.findById(id)); } catch (e) { done(e, null); }
});

export default passport;
