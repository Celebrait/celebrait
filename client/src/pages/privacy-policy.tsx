import Header from "@/components/header";
import Footer from "@/components/footer";
import { CONTROLLER, PRIVACY_LAST_UPDATED as LAST_UPDATED } from "@/lib/legal";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="backdrop-blur-sm bg-white/80 rounded-2xl border border-white/50 shadow-xl p-8 lg:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 text-center">
            Privacy Policy
          </h1>
          <p className="text-center text-sm text-gray-500 mb-10">
            How Celebrait handles your personal information
          </p>

          <div className="prose prose-gray max-w-none space-y-8">
            <div className="text-sm text-gray-600">
              <p>
                <strong>Last updated:</strong> {LAST_UPDATED}
              </p>
              <p>
                <strong>Applies to:</strong> {CONTROLLER.website} and the
                Celebrait card-making service
              </p>
            </div>

            {/* ── At a glance ─────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                At a glance
              </h2>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  We collect the details you give us to make and deliver your
                  cards — your email, the words you write, any photos you
                  upload, and (if you order a printed or digital card) delivery
                  and payment details.
                </li>
                <li>
                  To create a card, your photos and the text you provide are
                  sent to third-party AI image services (OpenAI and Google) that
                  generate the artwork.
                </li>
                <li>
                  We <strong>do not</strong> use advertising or analytics
                  cookies, and we <strong>do not</strong> sell or rent your data.
                  The only cookie we set is the one that keeps you signed in.
                </li>
                <li>
                  You can access, correct or delete your data at any time —
                  deleting a card erases its images and details from our storage.
                </li>
              </ul>
            </section>

            {/* ── 1. Who we are ───────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                1. Who we are
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {CONTROLLER.legalName}, trading as {CONTROLLER.tradingAs} ("we",
                "us", "our"), is the data controller responsible for your
                personal information under the UK General Data Protection
                Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mt-4 text-gray-700">
                <p>
                  <strong>{CONTROLLER.legalName}</strong>
                </p>
                <p>{CONTROLLER.address}</p>
                <p>Email: {CONTROLLER.privacyEmail}</p>
                <p>ICO registration: {CONTROLLER.icoNumber}</p>
              </div>
            </section>

            {/* ── 2. Information we collect ───────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                2. Information we collect
              </h2>

              <h3 className="text-xl font-medium text-gray-800 mb-3">
                2.1 Information you give us
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>Account details</strong> — your email address (used to
                  sign in via a one-time code) and, optionally, your first and
                  last name.
                </li>
                <li>
                  <strong>Card content</strong> — the recipient's name and the
                  occasion, the message and text you write, and the scene you
                  describe.
                </li>
                <li>
                  <strong>Photos</strong> — any images you upload to feature on a
                  card, together with the filename and any crop you choose.
                </li>
                <li>
                  <strong>Address book</strong> (optional) — if you save people
                  to remember, the name, relationship, occasion dates, and any
                  email, phone number, postal address or notes you add for them.
                </li>
                <li>
                  <strong>Order &amp; delivery details</strong> — when you buy a
                  printed or digital card: your name, email and phone; the
                  recipient's name, and their email or postal address for
                  delivery; and any gift message.
                </li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">
                2.2 Information created when you use Celebrait
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>Generated card images</strong> — the front and inside
                  artwork the AI produces from your inputs.
                </li>
                <li>
                  <strong>Photo analysis</strong> — after you upload a photo, an
                  AI service produces a short, non-identifying description of it
                  (for example, how many people appear) to help create your card.
                </li>
                <li>
                  <strong>Sign-in &amp; usage records</strong> — one-time login
                  codes (deleted shortly after use), your session, and technical
                  records of card generations we keep to run the service, monitor
                  cost and prevent abuse.
                </li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">
                2.3 Payment information
              </h3>
              <p className="text-gray-700 leading-relaxed">
                When you pay, your card payment is processed by our payment
                provider (Stripe) on their own secure systems. We do not receive
                or store your full card number — only a reference to the
                transaction and its status.
              </p>
            </section>

            {/* ── 3. Photos of other people ───────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                3. Photos, likenesses and AI generation
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Celebrait is an AI card maker. To create your card, the photos
                you upload and the text you provide (including the recipient's
                name and your message) are sent to trusted third-party AI
                providers — <strong>OpenAI</strong> and{" "}
                <strong>Google</strong> — which generate the artwork and, in the
                case of Google, produce the short photo description mentioned
                above. We only send what is needed to make the card; we do not
                send your email address, the recipient's contact details, or your
                payment information to these providers.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Because photos often show other people, please only upload images
                of someone else if you have their permission to do so. You are
                responsible for having the right to use any photo you upload. If
                you believe a photo of you has been uploaded without your
                consent, contact us at {CONTROLLER.privacyEmail} and we will
                remove it.
              </p>
              <p className="text-gray-700 leading-relaxed">
                We do not use your photos to identify people biometrically, to
                train our own or third parties' AI models for unrelated purposes,
                or for advertising.
              </p>
            </section>

            {/* ── 4. How & why (legal bases) ──────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                4. How and why we use your information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Under UK GDPR we must have a lawful basis for each use of your
                data. Our uses and their bases are:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-700 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50 text-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-semibold">What we do</th>
                      <th className="px-4 py-2 font-semibold">Lawful basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-2">
                        Create, preview and deliver your cards; process and fulfil
                        your orders
                      </td>
                      <td className="px-4 py-2">
                        Performance of a contract with you
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        Send you a one-time sign-in code and service emails about
                        your cards and orders
                      </td>
                      <td className="px-4 py-2">
                        Performance of a contract / our legitimate interests in
                        running the service
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        Uploading and processing photos of people to make a card
                      </td>
                      <td className="px-4 py-2">
                        Your consent (you choose to upload); performance of a
                        contract
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        Occasion reminders and gentle "your card is waiting"
                        follow-ups
                      </td>
                      <td className="px-4 py-2">
                        Your consent / our legitimate interests (you can opt out
                        at any time)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        Keep the service secure, prevent abuse and manage cost
                      </td>
                      <td className="px-4 py-2">Our legitimate interests</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        Keep records of orders and payments
                      </td>
                      <td className="px-4 py-2">
                        Compliance with our legal obligations (e.g. tax)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 5. Sharing / sub-processors ─────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                5. Who we share your information with
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We do not sell, rent or trade your personal information. We share
                it only with the service providers that help us run Celebrait,
                each acting under contract and only for the purposes below:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-700 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50 text-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Provider</th>
                      <th className="px-4 py-2 font-semibold">Purpose</th>
                      <th className="px-4 py-2 font-semibold">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-2">Neon</td>
                      <td className="px-4 py-2">Database hosting</td>
                      <td className="px-4 py-2">EU (Frankfurt)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Cloudflare (R2)</td>
                      <td className="px-4 py-2">Image storage &amp; delivery</td>
                      <td className="px-4 py-2">United States / global</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Render</td>
                      <td className="px-4 py-2">Application hosting</td>
                      <td className="px-4 py-2">United States</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">OpenAI</td>
                      <td className="px-4 py-2">AI card image generation</td>
                      <td className="px-4 py-2">United States</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Google</td>
                      <td className="px-4 py-2">
                        AI card image generation &amp; photo description
                      </td>
                      <td className="px-4 py-2">United States</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Brevo</td>
                      <td className="px-4 py-2">Sending our emails</td>
                      <td className="px-4 py-2">EU</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Stripe</td>
                      <td className="px-4 py-2">Payment processing</td>
                      <td className="px-4 py-2">United States / EU</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Print &amp; delivery partner</td>
                      <td className="px-4 py-2">
                        Printing and posting physical cards (recipient name and
                        address only)
                      </td>
                      <td className="px-4 py-2">EU / United Kingdom</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-gray-700 leading-relaxed mt-4">
                We may also disclose information if required by law, to protect
                our rights, or in connection with a business sale or
                reorganisation.
              </p>
            </section>

            {/* ── 6. International transfers ───────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                6. International transfers
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Some of our providers are based outside the UK, including in the
                United States. Where your information is transferred outside the
                UK, we rely on appropriate safeguards recognised under UK data
                protection law — such as the UK's adequacy regulations, the UK
                International Data Transfer Agreement, or the UK Addendum to the
                EU Standard Contractual Clauses — so that your information
                continues to be protected. You can ask us for more detail using
                the contact below.
              </p>
            </section>

            {/* ── 7. Retention ────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                7. How long we keep your information
              </h2>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>Sign-in codes</strong> — deleted within minutes of
                  being issued or used.
                </li>
                <li>
                  <strong>Cards, photos and drafts</strong> — kept while your
                  account is active so you can view and reorder them. When you
                  delete a card, its images and details are removed from our
                  storage. When you close your account, we delete your cards,
                  photos and address book.
                </li>
                <li>
                  <strong>Order and payment records</strong> — retained for as
                  long as required to meet our legal and accounting obligations
                  (generally up to six years).
                </li>
                <li>
                  <strong>Operational records</strong> — technical logs used to
                  run and secure the service are kept only as long as needed for
                  those purposes.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You can ask us to delete your information sooner at any time (see
                "Your rights").
              </p>
            </section>

            {/* ── 8. Your rights ──────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                8. Your rights
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Under UK data protection law you have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>access the personal information we hold about you;</li>
                <li>ask us to correct information that is wrong or incomplete;</li>
                <li>ask us to delete your information ("right to erasure");</li>
                <li>ask us to restrict or object to how we use it;</li>
                <li>
                  ask for a copy of information you gave us in a portable format;
                </li>
                <li>
                  withdraw your consent at any time, where we rely on consent.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise any of these rights, email us at{" "}
                {CONTROLLER.privacyEmail}. We will respond within one month. You
                also have the right to complain to the UK's data protection
                regulator, the Information Commissioner's Office (ICO), at{" "}
                <a
                  href="https://ico.org.uk"
                  className="text-purple-700 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ico.org.uk
                </a>{" "}
                or on 0303 123 1113 — though we'd appreciate the chance to help
                first.
              </p>
            </section>

            {/* ── 9. Security ─────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                9. How we protect your information
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We use appropriate technical and organisational measures to
                protect your information, including encryption in transit
                (HTTPS), access controls, and reputable infrastructure providers.
                No online service can be completely secure, but we work to protect
                your data and will notify you and the ICO of a serious breach
                where the law requires.
              </p>
            </section>

            {/* ── 10. Cookies ─────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                10. Cookies
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We use a single essential cookie to keep you securely signed in.
                We do not use advertising, analytics or tracking cookies, so no
                cookie banner is required. You can clear cookies in your browser
                settings, but doing so will sign you out.
              </p>
            </section>

            {/* ── 11. Children ────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                11. Children
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Celebrait is intended for adults. It is not directed at children,
                and we do not knowingly collect personal information from anyone
                under 16. If you believe a child has provided us with personal
                information, please contact us and we will delete it.
              </p>
            </section>

            {/* ── 12. Changes ─────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                12. Changes to this policy
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this policy from time to time. If we make a
                significant change, we will update the "Last updated" date above
                and, where appropriate, let you know by email or in the app.
              </p>
            </section>

            {/* ── 13. Contact ─────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                13. Contact us
              </h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-2">
                  For any question about this policy or your personal
                  information, contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p>
                    <strong>{CONTROLLER.legalName}</strong> (trading as{" "}
                    {CONTROLLER.tradingAs})
                  </p>
                  <p>{CONTROLLER.address}</p>
                  <p>Email: {CONTROLLER.privacyEmail}</p>
                  <p>Website: {CONTROLLER.website}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
