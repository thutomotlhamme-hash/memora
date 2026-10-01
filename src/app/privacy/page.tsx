import { ContactLink, LegalPage, SupplierDetails } from '@/components/LegalPage';
import { contact, legal } from '@/lib/config';
import { PRODUCT } from '@/lib/plans';

export const metadata = { title: 'Privacy policy', description: 'How Memora collects, uses and protects personal information, in line with POPIA.' };

export default function PrivacyPage() {
  const us = legal.name || contact.businessName;
  const year = PRODUCT.publicDays === 365 ? 'one year' : `${PRODUCT.publicDays} days`;
  return (
    <LegalPage eyebrow="Privacy" title="Privacy policy" updated="1 October 2026">
      <p>
        {us} (“Memora”, “we”) helps families and funeral homes create funeral memorials and run the funeral day. We handle information about grieving
        families with care, and we process personal information in line with South Africa’s Protection of Personal Information Act, 2013 (POPIA).
      </p>
      <SupplierDetails />

      <h2>Who is responsible for your information</h2>
      <ul>
        <li>For a memorial a family makes and pays for themselves, Memora is the responsible party.</li>
        <li>
          For a memorial made by or through a funeral home, that funeral home is the responsible party and Memora processes the information for it, as its operator,
          under a written agreement. You can contact either of us.
        </li>
        <li>For our own accounts, billing, security and support records, Memora is the responsible party.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name (optional), the cellphone number or email you log in with, and your password, stored only as a secure hash by our
          sign-in provider. We never send codes or messages to your number.
        </li>
        <li>
          <strong>Memorial content:</strong> the name, dates and portrait of the person who passed away, their life story, a family message, the funeral journey
          (places, times, map pins and instructions) and the order of service.
        </li>
        <li>
          <strong>Funeral homes and groups:</strong> the business’s name, contact person, number, email, area, logo and colours; the names and numbers of the staff it
          appoints and their roles; its branches and regions; and its plan, usage and invoices.
        </li>
        <li>
          <strong>Activity records:</strong> who published, edited or changed what, and when (for example who appointed a staff member, changed a role, published a
          memorial or changed a price). We keep these to keep accounts safe and settle questions. We don’t record your IP address in them.
        </li>
        <li>
          <strong>Gifts:</strong> the buyer’s name and email, the recipient’s name, WhatsApp number and (optionally) email, the loved one’s name, an estimated
          funeral date and an optional message.
        </li>
        <li>
          <strong>Payments:</strong> Yoco processes card payments. We never see or store card numbers; we keep the amount, date and a payment reference.
        </li>
        <li>
          <strong>Procession location (funeral day only):</strong> if a coordinator chooses to share, their phone sends its location while the run-sheet is open. We
          keep only the latest position, never a history. Anyone with the memorial link can see it while sharing is on. It is erased when sharing is paused or
          ended, on arrival, or six hours after it started.
        </li>
        <li>
          <strong>The unveiling list:</strong> if you ask to hear about unveiling pages, we keep that request, the memorial it is for and any date you give us.
        </li>
        <li>
          <strong>Integration keys:</strong> for groups that connect their own systems, we keep only a fingerprint (a one-way hash) of each key, never the key.
        </li>
        <li>
          <strong>Guest drafts:</strong> a memorial started without an account stays in your own browser and is not sent to us until you create an account.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To create, store and publish the memorial you ask for, and show guests the funeral details and directions you choose to publish.</li>
        <li>To let a funeral home and its staff (and, in a group, head office) prepare, publish and run the funerals they look after.</li>
        <li>To bill funeral homes and groups for what they use, and to take payment and prevent fraud.</li>
        <li>For gifts: to let the buyer send the private link, and so our team can help the recipient on WhatsApp. We use these details only for that gift.</li>
        <li>To tell you about the unveiling, only if you asked us to.</li>
        <li>To answer your questions, keep the service secure and meet our legal duties.</li>
      </ul>
      <p>We don’t sell personal information. We don’t send marketing or use your information for advertising without your separate consent.</p>

      <h2>What is public, and who can see what</h2>
      <ul>
        <li>
          Nothing is public until a memorial is published. Once published, the memorial page (name, dates, portrait, story, programme, funeral journey and family
          message) can be seen by anyone with its link or QR code for {year}. Memorial pages ask search engines not to index them. After that the page becomes
          private again; the family keeps access.
        </li>
        <li>
          A funeral home’s staff see the memorials of their own branch (owners see every branch). In an Enterprise group, head office and regional managers see the
          memorials in their part of the group. Group reports show numbers only, never stories or family contact details.
        </li>
        <li>
          Memora’s own team can see accounts and memorials only as far as their role needs, to support you. When they open a funeral home or group it is marked as
          Memora support and their actions are logged.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We use trusted service providers who process information only on our instructions:</p>
      <ul>
        <li>Supabase (database, file storage and sign-in), hosted in the European Union.</li>
        <li>Netlify (website hosting).</li>
        <li>Yoco (card payments).</li>
        <li>
          OpenStreetMap and komoot’s Photon service (map tiles and place suggestions, used when you search for a place or set a map pin; only what you type in the
          search box is sent).
        </li>
      </ul>
      <p>
        Some of these providers store information outside South Africa. We only use providers bound by data-protection laws or agreements that give protection
        comparable to POPIA. We share information with authorities only when the law requires it.
      </p>

      <h2>How we protect it</h2>
      <p>
        Information is encrypted in transit and stored with access rules that limit each person to what their role allows. Passwords and integration keys are
        stored only as hashes. If personal information is ever compromised, we will tell the Information Regulator and the people affected (and, for a funeral
        home’s memorials, the funeral home) as soon as reasonably possible.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Memorial content: while the account exists, so the family keeps its memorial and keepsakes. Delete an unpublished memorial any time, or ask us to delete a published one or your whole account.</li>
        <li>Procession location: erased automatically, at the latest six hours after sharing started.</li>
        <li>Invite, gift and password-reset links: they stop working when used, revoked or expired; we keep a record of them with your account.</li>
        <li>Activity records, invoices and payment records: for as long as tax and company law require (generally five years), then deleted.</li>
        <li>The unveiling list: until we have told you about unveiling pages, or until you ask us to remove you.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You may ask to see the personal information we hold about you, ask us to correct or delete it, or object to how we use it. Contact us via <ContactLink />
        {legal.informationOfficer ? `, or our Information Officer, ${legal.informationOfficer}` : ''}. If you are not satisfied with our response, you may complain to
        the Information Regulator (South Africa) at inforeg.org.za.
      </p>

      <h2>Cookies</h2>
      <p>
        We use only the cookies needed to keep you signed in. Guest drafts and a few conveniences (such as having agreed to share location on a phone) are kept in
        your browser’s local storage. We don’t use advertising or tracking cookies.
      </p>

      <h2>Children</h2>
      <p>Memora is for adults. Accounts may only be created by people aged 18 or older.</p>

      <h2>Changes and contact</h2>
      <p>
        We will show the date of the latest version of this policy here and tell account holders about significant changes. Questions about privacy: contact us
        via <ContactLink />.
      </p>
    </LegalPage>
  );
}
