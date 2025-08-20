import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';

const Terms: React.FC = () => {
  const LAST_UPDATED = '20 Aug 2025';

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Terms & Conditions"
        description="Terms for using Nakoda Mobile’s website, products, OEM services, and promotions."
        canonicalPath="/terms"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Terms & Conditions',
          url: 'https://your-frontend-domain.com/terms'
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Terms &amp; Conditions</h1>
          <p className="mt-3 text-gray-200">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-[270px,1fr] gap-10">
          {/* In-page nav */}
          <aside className="bg-white rounded-xl shadow-sm p-4 h-max sticky top-4 hidden lg:block">
            <p className="text-sm font-semibold text-gray-700 mb-3">On this page</p>
            <ul className="space-y-2 text-sm">
              {[
                ['intro','Introduction'],
                ['accounts','Eligibility & Accounts'],
                ['product','Product Info & Images'],
                ['pricing','Pricing, Errors & Promotions'],
                ['orders','Orders, Acceptance & Cancellation'],
                ['payments','Payments, EMI & Fraud Checks'],
                ['shipping','Shipping, Delivery & Customs'],
                ['returns','Returns, Refunds & Warranty'],
                ['oem','OEM / Bulk Terms'],
                ['ugc','User Reviews & Content'],
                ['conduct','Acceptable Use & Prohibited Activities'],
                ['force','Force Majeure'],
                ['liability','Warranty & Liability'],
                ['indemnity','Indemnification'],
                ['termination','Termination'],
                ['law','Governing Law & Disputes'],
                ['changes','Changes to Terms'],
                ['contact','Contact Us'],
              ].map(([id,label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-gray-600 hover:text-blue-600">{label}</a>
                </li>
              ))}
            </ul>
          </aside>

          <article className="bg-white rounded-xl shadow-sm p-6 md:p-8 prose prose-gray max-w-none">
            <h2 id="intro">Introduction</h2>
            <p>
              Welcome to <strong>Nakoda Mobile</strong>. These Terms govern your use of our website,
              products, services, and OEM/bulk offerings. By using our site, you agree to these Terms and
              our <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>

            <h2 id="accounts">Eligibility & Accounts</h2>
            <ul>
              <li>You must be capable of entering into a binding agreement under applicable law.</li>
              <li>You’re responsible for your account and for keeping credentials secure.</li>
              <li>Provide accurate and complete information; notify us of any changes.</li>
            </ul>

            <h2 id="product">Product Info & Images</h2>
            <ul>
              <li>Specs, images, and colors may vary slightly due to lighting/screen differences.</li>
              <li>Accessory compatibility info is provided in good faith; verify with your device model.</li>
              <li>We may update features or packaging without notice to improve quality.</li>
            </ul>

            <h2 id="pricing">Pricing, Errors & Promotions</h2>
            <ul>
              <li>All prices are in INR unless stated otherwise and may change without notice.</li>
              <li>We may correct pricing/typographical errors. If discovered after order, we will notify you to confirm or cancel.</li>
              <li>Coupons, promo codes, gift cards, and referral credits are subject to specific terms and may be limited by time, usage, or category.</li>
              <li>Pre-order/backorder timelines are estimates, not guarantees.</li>
            </ul>

            <h2 id="orders">Orders, Acceptance & Cancellation</h2>
            <ul>
              <li>Your order is an offer to purchase. Acceptance occurs when we dispatch the items.</li>
              <li>We may cancel/refuse orders due to stock limits, suspected fraud, pricing errors, or regulatory reasons.</li>
              <li>You can request cancellation before dispatch; post-dispatch, standard return rules apply.</li>
            </ul>

            <h2 id="payments">Payments, EMI & Fraud Checks</h2>
            <ul>
              <li>Payments are processed by trusted gateways; we don’t store full card details.</li>
              <li>We may run automated/manual fraud checks and request additional verification.</li>
              <li>EMI (if available) is subject to bank/provider terms; interest/processing fees may apply.</li>
            </ul>

            <h2 id="shipping">Shipping, Delivery & Customs</h2>
            <ul>
              <li>We ship via reputed carriers; delivery estimates are indicative.</li>
              <li>Risk of loss passes on delivery to your address or pick-up point.</li>
              <li>For international orders, you are responsible for customs duties, taxes, and import compliance.</li>
            </ul>

            <h2 id="returns">Returns, Refunds & Warranty</h2>
            <ul>
              <li>Standard return window is 30 days (unused, original packaging). Category-specific exceptions may apply.</li>
              <li>Warranty varies by manufacturer/product; proof of purchase may be required.</li>
              <li>Refunds are typically issued to the original payment method after inspection.</li>
            </ul>

            <h2 id="oem">OEM / Bulk Terms</h2>
            <ul>
              <li><strong>MOQ</strong>: minimum order quantities apply per product.</li>
              <li><strong>Branding</strong>: you warrant you own/licence the IP (logo/brand) provided for printing/packaging.</li>
              <li><strong>Proofing</strong>: production begins after written approval of samples/artwork/colour proofs.</li>
              <li><strong>Lead Times</strong>: communicated in the quote; timelines are estimates and may vary by volume/materials.</li>
              <li><strong>Tolerances</strong>: industry-standard variance in colour/finish/quantity may occur.</li>
              <li><strong>Shipping Terms</strong>: Incoterms (e.g., FOB/CIF/DDP) as specified in the quotation.</li>
              <li><strong>Non-cancellable after production start</strong> unless agreed in writing.</li>
            </ul>

            <h2 id="ugc">User Reviews & Content</h2>
            <ul>
              <li>By posting reviews, photos, or comments, you grant us a non-exclusive, royalty-free licence to use them for marketing and display.</li>
              <li>We may moderate/remove content that is illegal, infringing, misleading, or violates these Terms.</li>
            </ul>

            <h2 id="conduct">Acceptable Use & Prohibited Activities</h2>
            <ul>
              <li>No scraping, malware injection, bypassing security, or fraudulent activity.</li>
              <li>No infringement of third-party IP or violation of applicable law.</li>
              <li>No reselling or commercial use inconsistent with these Terms without permission.</li>
            </ul>

            <h2 id="force">Force Majeure</h2>
            <p>
              We are not liable for delays or failures caused by events beyond our reasonable control,
              including natural disasters, pandemics, labour disputes, acts of government, or internet outages.
            </p>

            <h2 id="liability">Warranty & Liability</h2>
            <ul>
              <li>Except as required by law, products are provided “as is” with manufacturer warranties where applicable.</li>
              <li>To the maximum extent permitted by law, our total liability for any claim shall not exceed the amount you paid to us for the product/service in the 12 months preceding the claim.</li>
              <li>We are not liable for indirect, incidental, special, consequential, or punitive damages.</li>
            </ul>

            <h2 id="indemnity">Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Nakoda Mobile and its officers, employees, and agents
              from claims arising out of your breach of these Terms, misuse of the site, or infringement of rights.
            </p>

            <h2 id="termination">Termination</h2>
            <p>
              We may suspend or terminate access for violations or suspected abuse. Provisions that naturally survive
              termination (e.g., IP, liability limits) remain in effect.
            </p>

            <h2 id="law">Governing Law & Disputes</h2>
            <p>
              These Terms are governed by the laws of India. Courts in New Delhi shall have exclusive jurisdiction,
              subject to applicable consumer protection laws. If arbitration is mandated by local law or separate agreement,
              that procedure will apply.
            </p>

            <h2 id="changes">Changes to Terms</h2>
            <p>
              We may update these Terms periodically. Continued use after changes constitutes acceptance of the updated Terms.
            </p>

            <h2 id="contact">Contact Us</h2>
            <p>
              <strong>Nakoda Mobile</strong><br />
              Shop No. 123, Electronics Market, Karol Bagh, New Delhi – 110055, India<br />
              Email: <a href="mailto:support@nakodamobile.com">support@nakodamobile.com</a> • Phone: +91 98765 43210
            </p>

            <p className="mt-8 text-sm text-gray-500">
              Related: <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Terms;
