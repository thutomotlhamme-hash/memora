import { ContactLink, LegalPage, SupplierDetails } from '@/components/LegalPage';
import { contact, legal, paymentsOn } from '@/lib/config';
import { PRICE_LABEL, PRODUCT, PRO_PLANS, VAT_RATE, formatMoney, type ProPlan } from '@/lib/plans';

export const metadata = {
  title: 'Terms of use',
  description: 'The terms for families, guests and funeral homes using Memora: memorials, the funeral day, gifts, Memora Pro and Enterprise.',
};

const PLANS: ProPlan[] = ['payg', 'pro', 'pro_plus', 'enterprise'];

export default function TermsPage() {
  const us = legal.name || contact.businessName;
  return (
    <LegalPage eyebrow="Terms" title="Terms of use" updated="2 October 2026">
      <p>
        These terms are an agreement between you and {us} (“Memora”, “we”). They apply when you create an account, make or publish a memorial, buy a gift, run a
        funeral day on Memora, or use Memora Pro as a funeral home. Please read them; the parts that limit our responsibility or set out what you must do are in
        plain words, and nothing in them takes away your rights under the Consumer Protection Act or the Electronic Communications and Transactions Act.
      </p>
      <SupplierDetails />
      <ul className="legal-toc">
        <li><a href="#families">Families</a></li>
        <li><a href="#homes">Memorials with a funeral home</a></li>
        <li><a href="#day">The funeral day</a></li>
        <li><a href="#payments">Payments and refunds</a></li>
        <li><a href="#year">The first year</a></li>
        <li><a href="#pro">Memora Pro</a></li>
        <li><a href="#enterprise">Enterprise</a></li>
        <li><a href="#liability">Liability</a></li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older. You log in with your cellphone number (or email) and a password. Before you publish a memorial we confirm the number is yours with a one-time code by WhatsApp or SMS, and you can reset a forgotten password the same way. Never share a code: Memora will never ask you for one.</li>
        <li>Keep your password to yourself. You are responsible for what happens under your account until you tell us it has been misused.</li>
        <li>We may suspend an account that is being misused, or that puts families, guests or the service at risk. We will tell you why unless the law or safety prevents it.</li>
      </ul>

      <h2 id="families">Memora Complete: a memorial for your family</h2>
      <p>
        You can build and preview a memorial for free.{' '}
        {paymentsOn
          ? `Publishing costs ${PRICE_LABEL} once-off for ${PRODUCT.name}.`
          : `During our launch, publishing is free. We will announce before we start charging ${PRICE_LABEL} once-off, and memorials published for free stay free.`}{' '}
        It includes the memorial page, the funeral journey with directions, Live Funeral Mode, the programme and run-sheet, procession sharing, the QR code,
        WhatsApp cards, the printable programme and the keepsake book. There is no subscription.
      </p>

      <h2 id="homes">Memorials made with a funeral home</h2>
      <ul>
        <li>If a funeral home sends you a link, or makes the memorial for you, the funeral home pays Memora for it. You pay Memora nothing.</li>
        <li>
          That funeral home’s staff can see and edit the memorial, publish it, and run the programme on the day. Their name and logo appear on it. Ask them, or us,
          if you want something changed.
        </li>
        <li>
          If the funeral home stops using Memora, or its access is suspended, the memorial stays up for the rest of its year and you keep access to it. You can ask
          us to put it in your name only.
        </li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>You keep ownership of everything you add. You allow us to store, display and print it only to provide the service you asked for.</li>
        <li>
          Only add photos and words you have the right to use, that are respectful and that you believe are accurate. Don’t publish other people’s private
          information (such as ID numbers, or a home address you were not asked to share). The family home appears only if you add it as a funeral stop.
        </li>
        <li>We may remove content that is unlawful or abusive, or that someone with the right to do so asks us to remove, and we will tell you when we do.</li>
      </ul>

      <h2 id="day">On the funeral day</h2>
      <ul>
        <li>
          <strong>Run-sheet links.</strong> Anyone with a run-sheet link (or its QR code) can change the programme and times that guests see. Share it only with
          the people running the day. Resetting it stops every old copy at once.
        </li>
        <li>
          <strong>Procession sharing.</strong> Sharing a phone’s location is always a choice made on that phone, which first explains what is shared. Only the latest
          position is kept; it is erased when sharing ends, on arrival, or after six hours. Never handle the phone while driving.
        </li>
        <li>
          <strong>Times and arrival estimates</strong> are shown as the family or funeral home entered them, and estimates are just that. Changes usually reach
          guests within seconds, but connections vary. Directions open in third-party map apps, which have their own terms.
        </li>
      </ul>

      <h2 id="payments">Payments and refunds</h2>
      <ul>
        <li>Prices are in South African rand. Card payments are processed by Yoco; we never see your card number.</li>
        <li>
          If you have paid for a memorial but not yet published it, you can ask for a full refund within 7 days of paying. Publishing delivers the service, so
          we don’t refund a published memorial unless the law requires it.
        </li>
        <li>If something goes wrong because of a fault on our side, tell us and we will put it right, or refund you if we can’t.</li>
      </ul>

      <h2>Gifts</h2>
      <ul>
        <li>A gift pays for one memorial. Its private link works once, for whoever opens it and signs in, so send it only to the person it is for.</li>
        <li>An unused gift can be refunded to the buyer on request within 30 days of purchase.</li>
        <li>By buying a gift you confirm the recipient knows you are sharing their details, so our team can contact them about the memorial.</li>
      </ul>

      <h2 id="year">The first year, and what comes next</h2>
      <ul>
        <li>
          A published memorial stays public for {PRODUCT.publicDays === 365 ? 'one year' : `${PRODUCT.publicDays} days`} from the day it is published, long
          enough for the tombstone unveiling. After that it becomes private; the family keeps access and the keepsakes.
        </li>
        <li>
          In the last months you may ask to hear about unveiling pages. Asking costs nothing and commits you to nothing; we will only use it to tell you about
          the unveiling. If we offer unveiling pages or another year online, they will have their own price, shown before you buy.
        </li>
      </ul>

      <h2 id="pro">Memora Pro: for funeral homes</h2>
      <p>This section applies to a funeral home (and the people it appoints) that uses Memora Pro. Signing up confirms you may agree to it for the business.</p>
      <div className="board-wrap">
        <table className="board legal-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Monthly fee</th>
              <th>Funerals included</th>
              <th>Each additional funeral</th>
              <th>Branches</th>
              <th>Onboarding</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((id) => {
              const p = PRO_PLANS[id];
              return (
                <tr key={id}>
                  <td>{p.name}</td>
                  <td>{p.quoted ? `From ${formatMoney(p.monthlyMinor)}` : p.monthlyMinor ? formatMoney(p.monthlyMinor) : 'None'}</td>
                  <td>{p.quoted ? 'Per agreement' : p.includedMemorials || '—'}</td>
                  <td>{p.quoted ? `From ${formatMoney(p.overageMinor)}` : formatMoney(p.overageMinor)}</td>
                  <td>{p.branches ?? 'Per agreement'}</td>
                  <td>{p.quoted ? 'Per agreement' : p.onboardingMinor ? formatMoney(p.onboardingMinor) : 'None'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul>
        <li>
          Prices exclude VAT. Once we are VAT-registered, VAT ({Math.round(VAT_RATE * 100)}%) is added to every invoice. The price list on our Pro page may change;
          your price changes only as described under “Changes” below.
        </li>
        <li>
          <strong>What counts.</strong> A funeral counts once, in the month its memorial is first published. Drafts, previews, family links that are never
          finished and memorials that are never published don’t count. Editing, re-publishing, taking down or restoring a memorial never counts it again.
        </li>
        <li>
          <strong>Allowances</strong> reset on the first day of each month (South African time). Unused funerals don’t carry over. Funerals beyond the allowance
          are charged at your plan’s price per additional funeral.
        </li>
        <li>
          <strong>Trial.</strong> Nothing is billed while your home is in trial. We tell you before we make your account active, and billing starts from that
          month.
        </li>
        <li>
          <strong>Invoices</strong> are issued monthly for that month’s fee and funerals, with the once-off onboarding fee on the first one. Pay within 7 days of the
          invoice date unless your agreement says otherwise. Credits and corrections appear on the invoice with a reason.
        </li>
        <li>
          <strong>Term and cancelling.</strong> Pay-as-you-go has no fixed term: stop whenever you like. Pro and Pro Plus run for 12 months from when your account
          becomes active, then month to month. You may cancel a fixed-term agreement with 20 business days’ written notice; if you cancel before the term ends we
          may charge a reasonable cancellation fee, as the Consumer Protection Act allows where it applies. After the first 12 months, give one calendar month’s
          notice.
        </li>
        <li>
          <strong>Changing plan.</strong> Upgrades apply from the next month. Downgrades apply at the end of a fixed term. Your plan sets how many branches you may
          have.
        </li>
        <li>
          <strong>Late payment.</strong> If an invoice is more than 30 days overdue we will remind you, and after 7 more days we may suspend your staff’s access
          until it is paid. Published memorials always stay up for families.
        </li>
        <li>
          <strong>Your team.</strong> You choose who gets access and which role (owner, branch manager or arranger). You are responsible for what your staff do on
          Memora; remove people who leave. Changes to people and roles are recorded in an audit log.
        </li>
        <li>
          <strong>Your branding.</strong> You confirm you may use the logo and name you add. They appear on memorials, programmes and QR cards you make.
        </li>
        <li>
          <strong>Families’ information.</strong> For memorials your home makes, you are the responsible party under POPIA and Memora is your operator: we
          process that information only to provide the service, keep it secure, and tell you without undue delay if it is compromised. You confirm you have the
          family’s agreement to what you publish.
        </li>
        <li>
          <strong>When you leave.</strong> Published memorials stay up for the rest of their year and their families keep access. On request we will export your
          home’s memorial list and invoices.
        </li>
      </ul>

      <h2 id="enterprise">Memora Enterprise</h2>
      <ul>
        <li>
          Enterprise groups sign a written agreement with Memora. Where it differs from these terms (for example prices, allowances, service levels, term or
          notice), the agreement applies; otherwise these terms do.
        </li>
        <li>
          The group decides who holds which role (group administrator, regional manager, finance, brand, reporting or integrations) and is responsible for what
          they do. Group activity is recorded in the group’s audit log. Memora’s support team may open the group to help, clearly marked as Memora, and their
          actions are logged too.
        </li>
        <li>
          Integration keys are secret. Keep them out of shared code and messages, give each the least access it needs, and revoke any that may have leaked.
        </li>
        <li>If the group’s account is suspended or closed, staff lose access; published memorials stay up for families.</li>
      </ul>

      <h2>Using Memora fairly</h2>
      <p>
        Don’t use Memora to harass, impersonate or deceive anyone, to collect guests’ details, or to break the law. Don’t try to get into accounts or data that
        aren’t yours, copy the service in bulk, or test its security without our written permission. Tell us if you find a weakness and we will thank you.
      </p>

      <h2 id="liability">Availability and liability</h2>
      <p>
        We work hard to keep Memora available and your content safe, but we can’t promise it will never be interrupted, especially on a funeral day when phone
        networks are under strain. To the extent the law allows, we are not responsible for indirect losses, and our total liability to you is limited to what
        you paid us in the 12 months before the claim (for a family, the price of the memorial). This does not limit liability for our gross negligence or
        fraud, or your rights under the Consumer Protection Act.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms and will show the date of the latest version here. For funeral homes, we will give at least 30 days’ notice of a change to
        your price or of anything that materially affects you; you may cancel before it applies. A memorial you have already paid for keeps the terms it was
        bought under.
      </p>

      <h2>Law and disputes</h2>
      <p>
        South African law applies. If something goes wrong, please contact us first and we will try to resolve it within 10 business days. You may also approach
        the Consumer Goods and Services Ombud or the National Consumer Commission, and the South African courts have jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: contact us via <ContactLink />.
        {legal.address ? ` Legal notices may be delivered to ${legal.address}.` : ''}
      </p>
    </LegalPage>
  );
}
