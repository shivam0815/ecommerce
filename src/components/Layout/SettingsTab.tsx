// // src/components/profile/SettingsTab.tsx
// import React, { useEffect, useMemo, useState } from 'react';
// import clsx from 'clsx';
// import api from '../../config/api';
// import { useTranslation } from 'react-i18next';
// import { CheckCircleIcon, BellAlertIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

// type Theme = 'light' | 'dark';
// type Language = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu';

// interface UserPrefs {
//   notifications: boolean;
//   theme: Theme;       // kept for backend compatibility; always 'light' here
//   language: Language;
// }

// const DEFAULT_PREFS: UserPrefs = {
//   notifications: true,
//   theme: 'light',
//   language: 'en',
// };

// // ---------- helpers (no dark mode toggling) ----------
// const saveLocalPrefs = (prefs: UserPrefs) => {
//   localStorage.setItem('pref_notifications', String(prefs.notifications));
//   localStorage.setItem('pref_lang', prefs.language);
// };

// const loadLocalPrefs = (): Partial<UserPrefs> => {
//   const n = localStorage.getItem('pref_notifications');
//   const l = (localStorage.getItem('pref_lang') as Language) || undefined;
//   return {
//     notifications: n === null ? undefined : n === 'true',
//     language: l,
//     theme: 'light',
//   };
// };

// // ---------- component ----------
// const SettingsTab: React.FC = () => {
//   const { t, i18n } = useTranslation();

//   const [prefs, setPrefs] = useState<UserPrefs>({
//     ...DEFAULT_PREFS,
//     ...loadLocalPrefs(),
//   });

//   const [saving, setSaving] = useState(false);
//   const [loaded, setLoaded] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // Apply language on mount
//   useEffect(() => {
//     i18n.changeLanguage(prefs.language);
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   // Rehydrate from server (force theme to 'light' to keep UI pure white)
//   useEffect(() => {
//     (async () => {
//       try {
//         setError(null);
//         const res = await api.get('/auth/profile');
//         const srv = res?.data?.user?.preferences as Partial<UserPrefs> | undefined;
//         if (srv) {
//           setPrefs((prev) => {
//             const next: UserPrefs = {
//               notifications: srv.notifications ?? prev.notifications,
//               language: (srv.language as Language) ?? prev.language,
//               theme: 'light', // force light
//             };
//             i18n.changeLanguage(next.language);
//             saveLocalPrefs(next);
//             return next;
//           });
//         }
//       } catch {
//         // Silent fallback to local values
//       } finally {
//         setLoaded(true);
//       }
//     })();
//   }, [i18n]);

//   // Save to backend
//   const savePrefs = async () => {
//     try {
//       setSaving(true);
//       setError(null);

//       const payload: { preferences: UserPrefs } = {
//         preferences: { ...prefs, theme: 'light' }, // ensure light
//       };

//       const res = await api.put('/auth/preferences', payload);
//       if (res?.data?.success) {
//         saveLocalPrefs(payload.preferences);
//         alert(t('save') + ' ✅');
//       } else {
//         throw new Error('Update failed');
//       }
//     } catch (e: any) {
//       setError(e?.response?.data?.message || e?.message || 'Failed to save preferences');
//     } finally {
//       setSaving(false);
//     }
//   };

//   const savingDisabled = useMemo(() => saving || !loaded, [saving, loaded]);

//   return (
//     <div className="space-y-8 bg-white text-black min-h-screen p-6">
//       {/* Notifications */}
//       <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
//         <div className="p-6 border-b border-gray-200">
//           <div className="flex items-center gap-2">
//             <BellAlertIcon className="w-5 h-5 text-green-600" />
//             <h3 className="text-lg font-bold"> {t('notifications') || 'Notifications'} </h3>
//           </div>
//           <p className="text-sm text-gray-600 mt-1">
//             {t('notifications_desc') || 'Receive important updates about your orders and account.'}
//           </p>
//         </div>
//         <div className="p-6">
//           <label className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
//             <span className="font-medium"> {t('notifications') || 'Notifications'} </span>
//             <button
//               type="button"
//               onClick={() => setPrefs((p) => ({ ...p, notifications: !p.notifications }))}
//               className={clsx(
//                 'relative inline-flex h-7 w-14 items-center rounded-full transition',
//                 prefs.notifications ? 'bg-green-500' : 'bg-gray-300'
//               )}
//               aria-pressed={prefs.notifications}
//               aria-label="Toggle notifications"
//             >
//               <span
//                 className={clsx(
//                   'inline-block h-6 w-6 transform rounded-full bg-white transition',
//                   prefs.notifications ? 'translate-x-7' : 'translate-x-1'
//                 )}
//               />
//             </button>
//           </label>
//         </div>
//       </section>

//       {/* Language */}
//       <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
//         <div className="p-6 border-b border-gray-200">
//           <div className="flex items-center gap-2">
//             <GlobeAltIcon className="w-5 h-5 text-blue-600" />
//             <h3 className="text-lg font-bold"> {t('language') || 'Language'} </h3>
//           </div>
//           <p className="text-sm text-gray-600 mt-1">
//             {t('language_desc') || 'Select your preferred language.'}
//           </p>
//         </div>
//         <div className="p-6">
//           <select
//             value={prefs.language}
//             onChange={(e) => {
//               const lang = e.target.value as Language;
//               setPrefs((p) => ({ ...p, language: lang }));
//               i18n.changeLanguage(lang);
//               saveLocalPrefs({ ...prefs, language: lang, theme: 'light' });
//             }}
//             className="w-full max-w-sm border-2 border-gray-300 rounded-xl px-4 py-3 bg-white text-black focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
//           >
//             <option value="en">English</option>
//             <option value="hi">हिंदी (Hindi)</option>
//             <option value="bn">বাংলা (Bengali)</option>
//             <option value="ta">தமிழ் (Tamil)</option>
//             <option value="te">తెలుగు (Telugu)</option>
//             <option value="mr">मराठी (Marathi)</option>
//             <option value="gu">ગુજરાતી (Gujarati)</option>
//           </select>
//         </div>
//       </section>

//       {/* Save */}
//       <div className="flex justify-end">
//         <button
//           disabled={savingDisabled}
//           onClick={savePrefs}
//           className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-900 transition disabled:opacity-50"
//         >
//           <CheckCircleIcon className="w-5 h-5" />
//           {saving ? t('saving') || 'Saving…' : t('save') || 'Save Changes'}
//         </button>
//       </div>

//       {error && <p className="text-sm text-red-600">{error}</p>}
//     </div>
//   );
// };

// export default SettingsTab;
