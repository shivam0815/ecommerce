import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';

const Privacy: React.FC = () => {
  const LAST_UPDATED = '20 Aug 2025';

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Privacy Policy"
        description="How Nakoda Mobile collects, uses, shares, and protects your information."
        canonicalPath="/privacy"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Privacy Policy',
          url: 'https://nakodamobile.in/privacy'
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Privacy Policy</h1>
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
                ['info','What We Collect'],
                ['use','How We Use Information'],
                ['legal','Legal Bases (GDPR)'],
                ['cookies','Cookies & Tracking'],
                ['third','Third-Party Processors'],
                ['retention','Data Retention'],
                ['rights','Your Rights'],
                ['regional','Regional Notices (GDPR / CCPA / India)'],
                ['security','Data Security'],
                ['children','Children’s Privacy'],
                ['prefs','Managing Preferences'],
                ['changes','Changes to this Policy'],
                ['contact','Contact / Grievance Officer'],
              ].map(([id,label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-gray-600 hover:text-blue-600">{label}</a>
                </li>
              ))}
            </ul>
          </aside>

          <article className="bg-white rounded-xl shadow-sm p-6 md:p-8 prose prose-gray max-w-none">
            <p id="intro">
              This Privacy Policy explains how <strong>Nakoda Mobile</strong> (“we”, “us”, “our”) collects,
              uses, shares, and protects your information when you visit our website, shop products,
              subscribe to our newsletter, submit OEM inquiries, or contact support. By using our site,
              you agree to this Policy and our <Link to="/terms" className="text-blue-600 hover:underline">Terms &amp; Conditions</Link>.
            </p>

            <h2 id="info">What We Collect</h2>
            <ul>
              <li><strong>Account & Profile</strong>: name, email, phone, shipping/billing addresses.</li>
              <li><strong>Orders</strong>: items purchased, amounts, delivery info, order history.</li>
              <li><strong>Payments</strong>: payment status and references from gateway (we don’t store full card data).</li>
              <li><strong>OEM Inquiries</strong>: company name, contact person, email, phone, category, quantity, customization, message.</li>
              <li><strong>Newsletter</strong>: email address and subscription status.</li>
              <li><strong>Support</strong>: messages, attachments, correspondence.</li>
              <li><strong>Device/Usage</strong>: IP, device type, browser, pages viewed, referrer (for analytics and security).</li>
              <li><strong>Cookies</strong>: session IDs, preferences, analytics, and marketing tags.</li>
            </ul>

            <h2 id="use">How We Use Information</h2>
            <ul>
              <li>Process and deliver orders; manage returns and warranty.</li>
              <li>Provide OEM quotes, artwork proofing, and production updates.</li>
              <li>Send transactional emails/SMS (order updates, invoices, support).</li>
              <li>Send marketing emails (only if opted-in) and show relevant offers.</li>
              <li>Improve products, services, and site performance (analytics).</li>
              <li>Detect, prevent, and investigate fraud or abuse.</li>
              <li>Comply with legal obligations and enforce our Terms.</li>
            </ul>

            <h2 id="legal">Legal Bases (GDPR)</h2>
            <ul>
              <li><strong>Contract</strong>: to fulfill orders, OEM services, and requested support.</li>
              <li><strong>Consent</strong>: newsletters, certain cookies/marketing.</li>
              <li><strong>Legitimate Interests</strong>: security, analytics, service improvement.</li>
              <li><strong>Legal Obligation</strong>: tax, accounting, and compliance purposes.</li>
            </ul>

            <h2 id="cookies">Cookies & Tracking</h2>
            <p>We use cookies and similar technologies:</p>
            <ul>
              <li><strong>Essential</strong> – authentication, cart, checkout.</li>
              <li><strong>Functional</strong> – remembering preferences.</li>
              <li><strong>Analytics</strong> – site usage and performance (e.g., Google Analytics).</li>
              <li><strong>Marketing</strong> – newsletters, promotions, retargeting ads.</li>
            </ul>
            <p>
              You can control cookies in your browser and through our cookie settings (if configured).
              Note: blocking essential cookies may break site features.
            </p>

            <h2 id="third">Third-Party Processors</h2>
            <p>We may share limited data with trusted vendors strictly to provide our services:</p>
            <ul>
              <li><strong>Payment gateway</strong> (e.g., Razorpay/Stripe) – payment processing.</li>
              <li><strong>Email service</strong> (e.g., SMTP/Mailgun/SendGrid) – transactional & marketing emails.</li>
              <li><strong>Cloud media</strong> (e.g., Cloudinary) – product image hosting & optimization.</li>
              <li><strong>Analytics</strong> (e.g., Google Analytics) – usage measurement.</li>
              <li><strong>Shipping partners</strong> – delivery and tracking.</li>
              <li><strong>Customer support</strong> – ticketing or chat (if enabled).</li>
            </ul>
            <p>Each vendor is contractually obligated to protect your data and use it only for the specified purpose.</p>

            <h2 id="retention">Data Retention</h2>
            <div className="overflow-x-auto not-prose">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Typical Retention</th>
                    <th className="p-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Orders & invoices','7–10 years','Tax & accounting laws'],
                    ['Account profile','While account is active','Provide services; you can request deletion'],
                    ['OEM inquiries','24–36 months','Follow-ups and quoting history'],
                    ['Support messages','24 months','Quality assurance & dispute handling'],
                    ['Newsletter list','Until you unsubscribe','Marketing preferences'],
                    ['Analytics logs','12–24 months','Trend analysis & security']
                  ].map(([a,b,c],i)=>(
                    <tr key={i} className="border-t">
                      <td className="p-3">{a}</td>
                      <td className="p-3">{b}</td>
                      <td className="p-3">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 id="rights">Your Rights</h2>
            <ul>
              <li>Access, correct, or delete your data (subject to legal limits).</li>
              <li>Object to processing or request restriction in certain cases.</li>
              <li>Data portability (copy of your data in a machine-readable format).</li>
              <li>Withdraw consent for marketing at any time.</li>
              <li>Opt-out of “sale”/“share” (CCPA) if applicable.</li>
            </ul>
            <p>To exercise rights, contact us using the details below. We may verify your identity before fulfilling requests.</p>

            <h2 id="regional">Regional Notices (GDPR / CCPA / India DPDP)</h2>
            <ul>
              <li><strong>GDPR (EU/EEA/UK)</strong>: We rely on the legal bases listed above and may transfer data using appropriate safeguards (e.g., SCCs).</li>
              <li><strong>CCPA/CPRA (California)</strong>: You have rights to know, delete, correct, and opt-out of sale/share of personal info.</li>
              <li><strong>India DPDP</strong>: We process data as a Data Fiduciary per applicable rules; you may exercise rights to access, correction, and grievance redressal.</li>
            </ul>

            <h2 id="security">Data Security</h2>
            <p>
              We implement administrative, technical, and physical safeguards (e.g., HTTPS/TLS, access controls).
              No method of transmission or storage is 100% secure; we work continually to improve our protections.
            </p>

            <h2 id="children">Children’s Privacy</h2>
            <p>
              Our services are not directed to children under the age required by applicable law. We do not knowingly
              collect data from children. If you believe a child has provided data, please contact us for deletion.
            </p>

            <h2 id="prefs">Managing Preferences</h2>
            <ul>
              <li><strong>Newsletter</strong>: use the “unsubscribe” link in any email.</li>
              <li><strong>Cookies</strong>: adjust browser settings and our cookie banner (if available).</li>
              <li><strong>Account</strong>: update profile details in your account area.</li>
            </ul>

            <h2 id="changes">Changes to this Policy</h2>
            <p>
              We may update this Policy from time to time. We’ll update the “Last updated” date above and, where required,
              notify you via email or site banner.
            </p>

            <h2 id="contact">Contact / Grievance Officer</h2>
            <p>
              <strong>Nakoda Mobile</strong><br />
              Shop No. 123, Electronics Market, Karol Bagh, New Delhi – 110055, India<br />
              Email: <a href="mailto:privacy@nakodamobile.com">privacy@nakodamobile.com</a> • Phone: +91 98765 43210<br />
              For India DPDP grievances, please mention “DPDP Grievance” in your email subject.
            </p>

            <p className="mt-8 text-sm text-gray-500">
              Related: <Link to="/terms" className="text-blue-600 hover:underline">Terms &amp; Conditions</Link>
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
