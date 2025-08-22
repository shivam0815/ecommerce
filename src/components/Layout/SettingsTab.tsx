// src/components/profile/SettingsTab.tsx
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import api from '../../config/api';
import { CheckCircleIcon, BellAlertIcon, GlobeAltIcon, MoonIcon, SunIcon } from '@heroicons/react/24/solid';

type Theme = 'light' | 'dark';
type Language = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu';

interface UserPrefs {
  notifications: boolean;
  theme: Theme;
  language: Language;
}

interface Props {
  user: {
    _id: string;
    preferences?: Partial<UserPrefs>;
  };
  onUpdate: (data: Partial<{ preferences: UserPrefs }>) => Promise<boolean>;
}

const SettingsTab: React.FC<Props> = ({ user, onUpdate }) => {
  const [prefs, setPrefs] = useState<UserPrefs>({
    notifications: user.preferences?.notifications ?? true,
    theme: (user.preferences?.theme as Theme) ?? 'light',
    language: (user.preferences?.language as Language) ?? 'en',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Rehydrate from server (in case profile changed elsewhere)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/profile');
        if (res?.data?.user?.preferences) {
          setPrefs((prev) => ({
            ...prev,
            ...res.data.user.preferences,
          }));
        }
      } catch {
        // silent fallback to props
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const savePrefs = async () => {
    try {
      setSaving(true);
      const ok = await onUpdate({ preferences: prefs });
      if (ok) alert('Preferences updated ✅');
    } catch (e: any) {
      alert('Failed to save preferences: ' + (e?.response?.data?.message || e?.message || 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Notifications */}
      <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2">
            <BellAlertIcon className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Receive important updates about your orders and account.</p>
        </div>
        <div className="p-6">
          <label className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border">
            <span className="font-medium text-gray-800">Order & account alerts</span>
            <button
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, notifications: !p.notifications }))}
              className={clsx(
                'relative inline-flex h-7 w-14 items-center rounded-full transition',
                prefs.notifications ? 'bg-green-500' : 'bg-gray-300'
              )}
            >
              <span
                className={clsx(
                  'inline-block h-6 w-6 transform rounded-full bg-white transition',
                  prefs.notifications ? 'translate-x-7' : 'translate-x-1'
                )}
              />
            </button>
          </label>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2">
            {prefs.theme === 'dark' ? <MoonIcon className="w-5 h-5 text-indigo-600" /> : <SunIcon className="w-5 h-5 text-yellow-500" />}
            <h3 className="text-lg font-bold text-gray-900">Appearance</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Choose how things look.</p>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <label className="p-4 border rounded-xl flex items-center gap-3 cursor-pointer hover:shadow">
            <input
              type="radio"
              name="theme"
              className="sr-only"
              checked={prefs.theme === 'light'}
              onChange={() => setPrefs((p) => ({ ...p, theme: 'light' }))}
            />
            <SunIcon className={clsx('w-6 h-6', prefs.theme === 'light' ? 'text-yellow-500' : 'text-gray-400')} />
            <span className="font-medium">Light</span>
          </label>
          <label className="p-4 border rounded-xl flex items-center gap-3 cursor-pointer hover:shadow">
            <input
              type="radio"
              name="theme"
              className="sr-only"
              checked={prefs.theme === 'dark'}
              onChange={() => setPrefs((p) => ({ ...p, theme: 'dark' }))}
            />
            <MoonIcon className={clsx('w-6 h-6', prefs.theme === 'dark' ? 'text-indigo-600' : 'text-gray-400')} />
            <span className="font-medium">Dark</span>
          </label>
        </div>
      </section>

      {/* Language */}
      <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Language</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Select your preferred language.</p>
        </div>
        <div className="p-6">
          <select
            value={prefs.language}
            onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value as Language }))}
            className="w-full max-w-sm border-2 rounded-xl px-4 py-3 bg-gray-50 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
          </select>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          disabled={saving || !loaded}
          onClick={savePrefs}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 transition disabled:opacity-50"
        >
          <CheckCircleIcon className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
