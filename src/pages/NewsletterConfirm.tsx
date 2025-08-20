import React, { useEffect, useState } from 'react';
import { newsletterService } from '../services/newsletterService';
import { CheckCircle, XCircle } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';

const NewsletterConfirm: React.FC = () => {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [state, setState] = useState<'loading'|'ok'|'err'>('loading');
  const [message, setMessage] = useState('Confirming…');

  useEffect(() => {
    (async () => {
      try {
        const res = await newsletterService.confirm(token);
        setState('ok');
        setMessage(res?.data?.message || 'Subscription confirmed!');
      } catch (e: any) {
        setState('err');
        setMessage(e?.response?.data?.message || 'Confirmation failed.');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        {state === 'ok' ? (
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        ) : state === 'err' ? (
          <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
        ) : (
          <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-3"/>
        )}
        <h1 className="text-xl font-semibold mb-2">Newsletter</h1>
        alert.console('submitted');
        <p className="text-gray-600 mb-6">{message}</p>
        <Link to="/" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default NewsletterConfirm;
