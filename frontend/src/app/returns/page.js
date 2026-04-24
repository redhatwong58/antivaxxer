import LegalPage from '@/components/layout/LegalPage';

export const metadata = {
  title: 'Return & Refund Policy',
  description: 'ANTIVAXXER return and refund policy for all purchases.',
};

export default function ReturnsPage() {
  return (
    <LegalPage title="RETURN & REFUND POLICY" lastUpdated="">
      <p>
        We want you to be completely satisfied with your ANTIVAXXER purchase.
        If you are not satisfied, we accept returns within the guidelines below.
      </p>

      <h2>RETURN WINDOW</h2>
      <p>
        Items may be returned within <strong>30 days</strong> of delivery.
        Items must be unworn, unwashed, and in original condition with all
        tags attached.
      </p>

      <h2>NON-RETURNABLE ITEMS</h2>
      <p>
        Items that have been worn, washed, altered, or damaged by the customer
        are not eligible for return. Sale items and gift cards are final sale.
      </p>

      <h2>HOW TO INITIATE A RETURN</h2>
      <p>
        Contact us at <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a> with
        your order number and reason for return. We will provide a return shipping
        address and instructions. Return shipping costs are the responsibility of
        the customer unless the return is due to our error.
      </p>

      <h2>EXCHANGES</h2>
      <p>
        We offer exchanges for different sizes on the same product, subject to
        availability. Contact us to arrange an exchange.
      </p>

      <h2>REFUNDS</h2>
      <p>
        Once we receive and inspect your return, we will process your refund to
        the original payment method within <strong>5-7 business days</strong>.
        Shipping charges are non-refundable.
      </p>

      <h2>DAMAGED OR DEFECTIVE ITEMS</h2>
      <p>
        If you receive a damaged or defective item, contact us within 7 days of
        delivery with photos. We will send a replacement or issue a full refund
        including shipping.
      </p>

      <h2>CONTACT</h2>
      <p>
        For return questions, email{' '}
        <a href="mailto:support@antivaxxer.com">support@antivaxxer.com</a>.
      </p>
    </LegalPage>
  );
}
