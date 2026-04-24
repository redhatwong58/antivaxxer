import LegalPage from '@/components/layout/LegalPage';

export const metadata = {
  title: 'Terms of Service',
  description: 'ANTIVAXXER terms of service for use of our website and purchase of products.',
};

export default function TermsPage() {
  return (
    <LegalPage title="TERMS OF SERVICE" lastUpdated="">
      <p>
        Welcome to ANTIVAXXER. By accessing or using our website at antivaxxer.com
        (the &ldquo;Site&rdquo;), you agree to be bound by these Terms of Service.
        Please read them carefully before making a purchase or using our services.
      </p>

      <h2>USE OF THE SITE</h2>
      <p>
        You must be at least 18 years old to use this Site or make a purchase.
        By using this Site, you represent that you are at least 18 years of age.
        You agree to use the Site only for lawful purposes and in accordance with
        these Terms.
      </p>

      <h2>PRODUCTS AND PRICING</h2>
      <p>
        All product descriptions, images, and pricing on the Site are subject to
        change without notice. We reserve the right to modify or discontinue any
        product at any time. Prices are listed in US dollars and do not include
        applicable taxes or shipping unless otherwise stated.
      </p>
      <p>
        We make every effort to display product colors and images accurately.
        However, actual colors may vary depending on your monitor settings.
      </p>

      <h2>ORDERS AND PAYMENT</h2>
      <p>
        By placing an order, you are making an offer to purchase the products
        selected. All orders are subject to acceptance and availability. We
        reserve the right to refuse or cancel any order for any reason, including
        pricing errors, suspected fraud, or inventory limitations.
      </p>
      <p>
        Payment is processed securely through Stripe. We do not store your
        credit card information on our servers.
      </p>

      <h2>INTELLECTUAL PROPERTY</h2>
      <p>
        All content on this Site — including text, graphics, logos, images, and
        software — is the property of ANTIVAXXER and is protected by copyright,
        trademark, and other intellectual property laws. You may not reproduce,
        distribute, or create derivative works without our written permission.
      </p>

      <h2>USER ACCOUNTS</h2>
      <p>
        If you create an account, you are responsible for maintaining the
        confidentiality of your credentials and for all activities under your
        account. You agree to notify us immediately of any unauthorized use.
      </p>

      <h2>LIMITATION OF LIABILITY</h2>
      <p>
        To the fullest extent permitted by law, ANTIVAXXER shall not be liable
        for any indirect, incidental, special, or consequential damages arising
        from your use of the Site or purchase of products.
      </p>

      <h2>GOVERNING LAW</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the
        laws of the United States. Any disputes shall be resolved in the
        courts of competent jurisdiction.
      </p>

      <h2>CHANGES TO TERMS</h2>
      <p>
        We reserve the right to update these Terms at any time. Changes will be
        posted on this page with an updated &ldquo;Last Updated&rdquo; date.
        Continued use of the Site after changes constitutes acceptance of the
        revised Terms.
      </p>

      <h2>CONTACT</h2>
      <p>
        For questions about these Terms, contact us at{' '}
        <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a>.
      </p>
    </LegalPage>
  );
}
