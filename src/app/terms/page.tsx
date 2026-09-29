import { ContactLink, LegalPage } from '@/components/LegalPage';
import { contact } from '@/lib/config';
import { PRICE_LABEL, PRODUCT } from '@/lib/plans';

export const metadata = { title: 'Terms of use', description: 'The terms for using Memora, buying a memorial and giving one as a gift.' };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Terms of use" updated="29 September 2026">
      <p>
        These terms apply when you use Memora, operated by {contact.businessName}. By creating an account, buying a memorial or buying a gift you agree to
        them.
      </p>

      <h2>The service</h2>
      <p>
        You can build and preview a memorial for free. Publishing requires a one-off payment of {PRICE_LABEL} for {PRODUCT.name}. A published memorial stays
        public for one year from the day it is published, and it includes Live Funeral Mode, the QR code and all downloads. There is no subscription.
      </p>

      <h2>Your content</h2>
      <ul>
        <li>You keep ownership of everything you add. You give us permission to store and display it only to provide the service.</li>
        <li>
          Only add photos and words you have the right to use, and that are respectful and accurate. Don’t publish other people’s private information
          (such as ID numbers or home addresses) unless they have agreed. The family home is included only if you choose to add it as a funeral stop.
        </li>
        <li>We may remove content that is unlawful, abusive or that someone with the right to do so asks us to remove.</li>
      </ul>

      <h2>Payments and refunds</h2>
      <ul>
        <li>Prices are in South African rand. Card payments are processed by Yoco.</li>
        <li>
          If you have paid but not yet published, you can ask for a full refund within 7 days of paying. Once a memorial is published, the service has been
          delivered, so we don’t refund it unless the law requires us to.
        </li>
        <li>If something goes wrong with your memorial because of a fault on our side, contact us and we will put it right.</li>
      </ul>

      <h2>Gifts</h2>
      <ul>
        <li>
          A gift pays for one memorial. The private gift link can be used once, by whoever opens it and signs in. Please send it only to the person you are
          giving it to.
        </li>
        <li>An unused gift can be refunded to the buyer on request within 30 days of purchase.</li>
        <li>
          By buying a gift, you confirm that you are sharing the recipient’s details with their knowledge, so our team can contact them about the
          memorial.
        </li>
      </ul>

      <h2>Accuracy of funeral details</h2>
      <p>
        Funeral times, places and map pins are entered by the family. Memora shows them as provided and can’t guarantee they are correct. Directions open
        in third-party map apps.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work hard to keep Memora available and your content safe, but we can’t promise the service will never be interrupted. To the extent the law
        allows, our liability to you is limited to the amount you paid us. Nothing in these terms limits your rights under the Consumer Protection Act.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will show the date of the latest version on this page. Questions: contact us via <ContactLink />.
      </p>
    </LegalPage>
  );
}
