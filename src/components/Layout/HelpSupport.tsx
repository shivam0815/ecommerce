// src/components/Layout/HelpSupport.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LifebuoyIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';

const SUPPORT_EMAIL =
  (import.meta as any)?.env?.VITE_SUPPORT_EMAIL || 'support@example.com';
const SUPPORT_PHONE =
  (import.meta as any)?.env?.VITE_SUPPORT_PHONE || '+91 98765 43210';
const WHATSAPP_NUMBER =
  (import.meta as any)?.env?.VITE_SUPPORT_WHATSAPP || '919876543210'; // numeric only

const HelpSupport: React.FC = () => {
  const navigate = useNavigate();

  // Tabs (only Overview + Contact)
  const [active, setActive] = useState<'overview' | 'contact'>('overview');

  // Quick actions
  const cards = [
    {
      title: 'Order Issues',
      desc: 'Track, modify, or report an issue with your order.',
      go: () => navigate('/profile?tab=orders'),
    },
    {
      title: 'Returns & Refunds',
      desc: 'Window, eligibility & how to start a return.',
      go: () => navigate('/profile?tab=orders'),
    },
    {
      title: 'Payments',
      desc: 'Payment failures, double-charges & billing help.',
      go: () => navigate('/profile?tab=orders'),
    },
    {
      title: 'Product Warranty',
      desc: 'Warranty coverage and claim process.',
      go: () => navigate('/profile?tab=orders'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page head */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <LifebuoyIcon className="w-5 h-5 text-white" />
          </div>
        </div>
        {/* Tabs */}
        <div className="inline-flex rounded-lg bg-gray-100 p-1 w-full sm:w-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'contact', label: 'Get in touch' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key as typeof active)}
              className={clsx(
                'flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition',
                active === t.key
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-700 hover:text-gray-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {active === 'overview' && (
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <button
                key={c.title}
                onClick={c.go}
                className="group rounded-xl border border-gray-200 bg-white p-5 text-left hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition" />
                </div>
                <p className="text-sm text-gray-600 mt-1">{c.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick help bullets */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <InformationCircleIcon className="w-5 h-5 text-gray-900" />
                <h4 className="font-semibold text-gray-900">Quick help</h4>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-400">•</span>
                  Track orders in{' '}
                  <button
                    onClick={() => navigate('/profile?tab=orders')}
                    className="underline underline-offset-2"
                  >
                    Profile → Orders
                  </button>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-400">•</span>
                  Damaged item received? Start a return from your order details.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-400">•</span>
                  Payment deducted but order not created? It usually auto-reverses in 3–5 business days.
                </li>
              </ul>
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                Response time: typically under 24 hours on business days.
              </div>
            </div>

            {/* Contact cards (preview) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-white hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <EnvelopeIcon className="w-5 h-5" /> Email
                  </div>
                  <div className="text-sm text-gray-600 mt-1 break-all">
                    {SUPPORT_EMAIL}
                  </div>
                </a>

                <a
                  href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-white hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <PhoneIcon className="w-5 h-5" /> Call
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{SUPPORT_PHONE}</div>
                </a>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    'Hi, I need help with my order'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-white hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <ChatBubbleLeftRightIcon className="w-5 h-5" /> WhatsApp
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    9 AM – 8 PM, Mon–Sat (IST)
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT */}
      {active === 'contact' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 hover:bg-white hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <EnvelopeIcon className="w-5 h-5" /> Email
              </div>
              <div className="text-sm text-gray-600 mt-1 break-all">{SUPPORT_EMAIL}</div>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                Write now <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </div>
            </a>

            <a
              href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 hover:bg-white hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <PhoneIcon className="w-5 h-5" /> Call
              </div>
              <div className="text-sm text-gray-600 mt-1">{SUPPORT_PHONE}</div>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                Ring us <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </div>
            </a>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                'Hi, I need help with my order'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 hover:bg-white hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <ChatBubbleLeftRightIcon className="w-5 h-5" /> WhatsApp
              </div>
              <div className="text-sm text-gray-600 mt-1">9 AM – 8 PM, Mon–Sat (IST)</div>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                Start chat <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </div>
            </a>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Hours</div>
              <div className="mt-1 text-sm text-gray-800">Mon–Sat, 9 AM – 8 PM (IST)</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">SLA</div>
              <div className="mt-1 text-sm text-gray-800">Replies within 24 hours</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Order help</div>
              <div className="mt-1 text-sm text-gray-800">
                Manage from{' '}
                <button
                  onClick={() => navigate('/profile?tab=orders')}
                  className="underline underline-offset-2"
                >
                  Profile → Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSupport;
