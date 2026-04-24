import LegalPage from '@/components/layout/LegalPage';

export const metadata = {
  title: 'Shipping Policy',
  description: 'ANTIVAXXER shipping rates, delivery times, and policies.',
};

export default function ShippingPolicyPage() {
  return (
    <LegalPage title="SHIPPING POLICY" lastUpdated="">
      <h2>DOMESTIC SHIPPING</h2>
      <p>
        We currently ship within the <strong>United States</strong> only.
      </p>
      <p>
        <strong>Standard Shipping:</strong> 5-7 business days — $5.99 flat rate.
        Free on orders of $75 or more.
      </p>
      <p>
        Orders are processed within 1-2 business days. You will receive a
        tracking number via email once your order ships.
      </p>

      <h2>INTERNATIONAL SHIPPING</h2>
      <p>
        International shipping is not available at this time. We plan to add
        international shipping in a future update.
      </p>

      <h2>ORDER TRACKING</h2>
      <p>
        Once your order ships, you will receive an email with tracking
        information. You can also view tracking details in your account
        order history.
      </p>

      <h2>DELIVERY ISSUES</h2>
      <p>
        If your order has not arrived within the estimated delivery window,
        please check your tracking information first. If you need further
        assistance, contact us at{' '}
        <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a> with
        your order number.
      </p>

      <h2>LOST OR STOLEN PACKAGES</h2>
      <p>
        ANTIVAXXER is not responsible for packages that are lost or stolen
        after delivery confirmation by the carrier. If tracking shows delivered
        but you have not received your order, please contact the carrier first,
        then reach out to us for assistance.
      </p>

      <h2>CONTACT</h2>
      <p>
        For shipping questions, email{' '}
        <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a>.
      </p>
    </LegalPage>
  );
}
