import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginSuccess: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash; // e.g. "#token=eyJ..."
    if (hash) {
      const params = new URLSearchParams(hash.slice(1)); // remove the '#'
      const token = params.get('token');

      if (token) {
        // Persist token the same way as the app expects elsewhere
        localStorage.setItem('nakoda-token', token);
        // Optionally request user profile to populate UI on first load
        // Redirect to profile (user requested going directly to profile)
        navigate('/profile', { replace: true });
      } else {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return <p>Logging you in...</p>;
};

export default LoginSuccess;
