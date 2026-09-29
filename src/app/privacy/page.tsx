import { LegalPage } from '@/components/LegalPage';
import { contact } from '@/lib/config';
import { PRODUCT } from '@/lib/plans';

export const metadata = { title: 'Privacy policy', description: 'How Memora collects, uses and protects personal information, in line with POPIA.' };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Privacy policy" updated="29 September 2026">
      <p>
        {contact.businessName} (“Memora”, “we”) helps families create funeral memorials. We handle information about grieving families with care, and
        we process personal information in line with South Africa’s Protection of Personal Information Act, 2013 (POPIA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, email address and password (stored only as a secure hash by our authentication provider).
        </li>
        <li>
          <strong>Memorial content you add:</strong> the name, dates and portrait of the person who passed away, their life story, a family message, the
          funeral journey (places, times, map pins and instructions) and the order of service.
        </li>
        <li>
          <strong>Gifts:</strong> the buyer’s name and email, the recipient’s name, WhatsApp number and (optionally) email, the loved one’s name, an
          estimated funeral date and an optional message.
        </li>
        <li>
          <strong>Payments:</strong> Yoco processes card payments. We never see or store your card number; we keep only the amount, date and a payment
          reference.
        </li>
        <li>
          <strong>Guest drafts:</strong> a memorial started without an account stays in your own browser and is not sent to us until you create an
          account.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To create, store and publish the memorial you ask for, and to show guests the funeral details and directions you choose to publish.</li>
        <li>To take payment and prevent fraud.</li>
        <li>
          For gifts: to let the buyer send the private link, and so our team can contact the recipient on WhatsApp to help them finish the memorial before
          the funeral. We only use these details for that gift.
        </li>
        <li>To answer your questions and keep the service secure.</li>
      </ul>
      <p>We do not sell personal information, and we do not use it for advertising without your separate consent.</p>

      <h2>What is public</h2>
      <p>
        Nothing is public until you publish. Once published, the memorial page (name, dates, portrait, story, programme, funeral journey and family
        message) can be seen by anyone with its link or QR code for {PRODUCT.publicDays === 365 ? 'one year' : `${PRODUCT.publicDays} days`}. Memorial
        pages ask search engines not to index them. After that period the page becomes private again; the family keeps access.
      </p>

      <h2>Who we share it with</h2>
      <p>We use trusted service providers who process information only on our instructions:</p>
      <ul>
        <li>Supabase (database, file storage and sign-in), hosted in the European Union.</li>
        <li>Netlify (website hosting).</li>
        <li>Yoco (card payments).</li>
        <li>OpenStreetMap (map tiles and place search, used when you set a map pin).</li>
      </ul>
      <p>
        Some of these providers store information outside South Africa. We only use providers bound by data-protection laws or agreements that give
        protection comparable to POPIA.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep memorial content while your account exists so the family keeps its memorial and keepsakes. You can delete an unpublished memorial at any
        time from your account, or ask us to delete a published memorial or your whole account. We keep payment records for as long as tax law requires.
      </p>

      <h2>Your rights</h2>
      <p>
        You may ask to see the personal information we hold about you, ask us to correct or delete it, or object to how we use it. Email{' '}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>. If you are not satisfied with our response, you may complain to the Information
        Regulator (South Africa) at inforeg.org.za.
      </p>

      <h2>Cookies</h2>
      <p>
        We use only the cookies needed to keep you signed in. Guest drafts are kept in your browser’s local storage. We don’t use advertising or tracking
        cookies.
      </p>

      <h2>Children</h2>
      <p>Memora is for adults. Accounts may only be created by people aged 18 or older.</p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </LegalPage>
  );
}
