import React, { useState } from 'react';
import { QuestionMarkCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

const data = [
  { q: 'How long does delivery take?', a: 'Standard delivery takes 2–7 working days depending on your pincode.' },
  { q: 'What is the return policy?', a: 'You can return eligible items within 7 days of delivery if unused and in original packaging.' },
  { q: 'Which payment methods are accepted?', a: 'We accept UPI, major cards, net-banking, and popular wallets via Razorpay.' },
  { q: 'How do I claim warranty?', a: 'Contact support with your order number and issue details; we’ll guide you through the claim.' },
];

const FAQs: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <QuestionMarkCircleIcon className="w-5 h-5 text-gray-900" />
        <h3 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h3>
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden bg-white">
        {data.map((item, i) => {
          const active = open === i;
          return (
            <button
              key={item.q}
              onClick={() => setOpen(active ? null : i)}
              className="w-full text-left p-4 md:p-5 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{item.q}</div>
                  {active && <div className="mt-1 text-sm text-gray-600">{item.a}</div>}
                </div>
                <ChevronDownIcon className={clsx('w-5 h-5 text-gray-500 transition', active && 'rotate-180')} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FAQs;
