import LegalPage from '@/components/layout/LegalPage';

export const metadata = {
  title: 'Privacy Policy',
  description: 'ANTIVAXXER privacy policy — how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="PRIVACY POLICY" lastUpdated="">
      <p>
        ANTIVAXXER (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is
        committed to protecting your privacy. This Privacy Policy explains how we
        collect, use, and safeguard your information when you visit antivaxxer.com.
      </p>

      <h2>INFORMATION WE COLLECT</h2>
      <p>
        <strong>Information you provide:</strong> When you make a purchase or create
        an account, we collect your name, email address, shipping address, billing
        address, and payment information. Payment details are processed by Stripe
        and never stored on our servers.
      </p>
      <p>
        <strong>Automatically collected:</strong> We may collect information about
        your device, browser type, IP address, and browsing behavior through cookies
        and similar technologies, subject to your consent preferences.
      </p>

      <h2>HOW WE USE YOUR INFORMATION</h2>
      <p>
        We use your information to process orders and send confirmations, communicate
        about your account or orders, improve our website and products, send marketing
        emails (with your consent), and comply with legal obligations.
      </p>

      <h2>SHARING YOUR INFORMATION</h2>
      <p>
        We do not sell your personal information. We share information only with
        service providers necessary to operate our business: Stripe (payments),
        AWS (hosting and email), and shipping carriers (order fulfillment).
      </p>

      <h2>COOKIES</h2>
      <p>
        We use essential cookies to operate the website (cart, session) and optional
        analytics cookies to understand how visitors use the site. You can manage
        your cookie preferences through our cookie consent banner.
      </p>

      <h2>YOUR RIGHTS</h2>
      <p>
        You may request access to, correction of, or deletion of your personal
        information at any time by contacting us. California residents may have
        additional rights under the CCPA.
      </p>

      <h2>DATA SECURITY</h2>
      <p>
        We implement industry-standard security measures including HTTPS encryption,
        secure password hashing, and restricted access to personal data. No method
        of transmission over the internet is 100% secure, and we cannot guarantee
        absolute security.
      </p>

      <h2>CHILDREN</h2>
      <p>
        Our Site is not directed to individuals under 18. We do not knowingly
        collect information from children.
      </p>

      <h2>CHANGES</h2>
      <p>
        We may update this Privacy Policy periodically. Changes will be posted
        on this page with an updated date.
      </p>

      <h2>CONTACT</h2>
      <p>
        For privacy questions, contact us at{' '}
        <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a>.
      </p>
    </LegalPage>
  );
}
