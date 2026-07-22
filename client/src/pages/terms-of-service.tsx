import { KeeperHeader } from "@/components/landing/keeper-header";
import { CelebrationBackdrop } from "@/pages/hero-scroll-poc";
import { MarketingFooter } from "@/components/landing/marketing-footer";
import { CONTROLLER, TERMS_LAST_UPDATED as LAST_UPDATED } from "@/lib/legal";

export default function TermsOfService() {
  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="relative pt-32">

      <div className="container mx-auto px-4 pb-20 max-w-4xl">
        <div className="bg-white/85 backdrop-blur-sm rounded-3xl border border-keeper-hair shadow-[0_20px_60px_-24px_rgba(33,29,25,0.22)] p-8 lg:p-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-keeper-ink mb-2 text-center">
            Terms of Service
          </h1>
          <p className="text-center text-sm text-keeper-meta mb-10">
            The agreement between you and {CONTROLLER.tradingAs}
          </p>

          <div className="prose prose-stone max-w-none space-y-8">
            <div className="text-sm text-keeper-meta">
              <p>
                <strong>Last updated:</strong> {LAST_UPDATED}
              </p>
              <p>
                <strong>Applies to:</strong> {CONTROLLER.website} and the{" "}
                {CONTROLLER.tradingAs} service
              </p>
            </div>

            {/* ── Plain-English summary ───────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                The short version
              </h2>
              <p className="text-keeper-body leading-relaxed mb-3">
                This summary is for convenience only and is not part of the
                legal terms below — but here's the gist:
              </p>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  {CONTROLLER.tradingAs} helps you create personalised greeting
                  cards using AI, and send them digitally or as a printed card in
                  the post.
                </li>
                <li>
                  You keep ownership of the photos and words you provide. You
                  promise you're allowed to use them — especially photos of other
                  people.
                </li>
                <li>
                  You preview and approve your card before you pay. Because each
                  card is personalised to you, there's no general right to change
                  your mind once we start making it — but your legal rights if a
                  card is faulty, damaged or not as described are fully protected.
                </li>
                <li>
                  Don't use {CONTROLLER.tradingAs} to make anything illegal,
                  hateful, infringing, or that misuses someone's image. We can
                  refuse or remove such content.
                </li>
                <li>
                  We try hard to make the service great, but AI results vary and
                  the service is provided without guarantees of perfection.
                </li>
              </ul>
            </section>

            {/* ── 1. Who we are & agreement ───────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                1. Who we are and these terms
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                These Terms of Service ("Terms") are a legally binding agreement
                between you and {CONTROLLER.legalName}, trading as{" "}
                {CONTROLLER.tradingAs} ("we", "us", "our"), for your use of{" "}
                {CONTROLLER.website} and our AI greeting-card service (the
                "Service"). By creating an account, uploading content, or placing
                an order, you agree to these Terms. If you do not agree, please
                do not use the Service.
              </p>
              <div className="bg-brand-muted/30 p-4 rounded-lg text-keeper-body">
                <p>
                  <strong>{CONTROLLER.legalName}</strong> (trading as{" "}
                  {CONTROLLER.tradingAs})
                </p>
                <p>{CONTROLLER.address}</p>
                <p>Company number: {CONTROLLER.companyNumber}</p>
                <p>Email: {CONTROLLER.contactEmail}</p>
              </div>
              <p className="text-keeper-body leading-relaxed mt-4">
                Please also read our{" "}
                <a href="/privacy-policy" className="text-brand hover:text-brand-dark underline underline-offset-2">
                  Privacy Policy
                </a>
                , which explains how we handle your personal information and forms
                part of your agreement with us.
              </p>
            </section>

            {/* ── 2. Eligibility ──────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                2. Eligibility
              </h2>
              <p className="text-keeper-body leading-relaxed">
                You must be at least 18 years old and able to enter into a
                legally binding contract to use the Service. By using it, you
                confirm that you meet these requirements.
              </p>
            </section>

            {/* ── 3. Your account ─────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                3. Your account
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                You sign in using your email address and a one-time code we send
                you — there is no password to remember. You are responsible for:
              </p>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>keeping access to your email account secure;</li>
                <li>
                  the accuracy of the information you give us, including delivery
                  details;
                </li>
                <li>all activity that takes place through your account.</li>
              </ul>
              <p className="text-keeper-body leading-relaxed mt-4">
                Tell us promptly at {CONTROLLER.contactEmail} if you believe
                someone has accessed your account without permission.
              </p>
            </section>

            {/* ── 4. How the Service works ────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                4. How the Service works
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                {CONTROLLER.tradingAs} lets you describe an occasion, add a
                message, and optionally upload photos, and then uses artificial
                intelligence to generate greeting-card artwork. You can preview
                and refine your card, and — if you choose — order it as a digital
                card (delivered by email or link) and/or a printed card sent by
                post. We may also offer optional features such as saved contacts
                and occasion reminders.
              </p>
              <p className="text-keeper-body leading-relaxed">
                <strong>About the AI:</strong> cards are generated by machine
                learning and results vary. The same request can produce different
                results, and output may occasionally be unexpected or imperfect.
                You are always shown your card and given the chance to regenerate
                or adjust it before you decide to pay. Nothing is printed or sent
                to a recipient until you place an order.
              </p>
            </section>

            {/* ── 5. Your content & the licence you grant ─────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                5. Your content and the permission you give us
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                "Your Content" means the photos, text, names, messages and other
                material you provide. <strong>You keep ownership of Your
                Content.</strong> You grant us a non-exclusive, worldwide,
                royalty-free licence to host, store, reproduce, adapt and process
                Your Content <em>only</em> as needed to operate the Service —
                including sending it to the third-party AI and, where you order a
                printed card, print-and-delivery providers described in our
                Privacy Policy — so that we can create, preview, and deliver your
                card. This licence ends when Your Content is deleted, except for
                copies we must keep by law or that remain in routine backups for a
                limited period.
              </p>
              <p className="text-keeper-body leading-relaxed mb-2">
                <strong>Your promises about Your Content.</strong> You confirm
                that, for everything you upload or submit, you either own it or
                have all necessary rights and permissions, and that it does not
                infringe anyone's rights. In particular:
              </p>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  <strong>Photos of people:</strong> if a photo shows another
                  person, you confirm you have that person's permission to upload
                  their image and to have it used to create a card. For images of
                  children, you confirm you are a parent or guardian or have their
                  parent's or guardian's permission.
                </li>
                <li>
                  You will not upload content that infringes copyright,
                  trademarks, or other intellectual property, or that misuses a
                  person's likeness, name or privacy.
                </li>
              </ul>
              <p className="text-keeper-body leading-relaxed mt-4">
                You are responsible for Your Content. If someone believes their
                image or work has been used without permission, they can contact
                us at {CONTROLLER.contactEmail} and we will act promptly,
                including removing content where appropriate.
              </p>
            </section>

            {/* ── 6. Acceptable use ───────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                6. Acceptable use
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                You agree not to use the Service to create, upload, or request
                content that:
              </p>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>is unlawful, or promotes or facilitates unlawful activity;</li>
                <li>
                  infringes intellectual property rights — for example,
                  recreating a well-known character, brand, logo, or a
                  living person's likeness without the right to do so;
                </li>
                <li>
                  is hateful, harassing, defamatory, or discriminatory, or
                  incites violence;
                </li>
                <li>
                  is sexually explicit, or depicts a real person in a false,
                  demeaning, or misleading way (including deceptive "deepfake"
                  imagery);
                </li>
                <li>
                  exploits or endangers a minor, or sexualises anyone under 18;
                </li>
                <li>
                  invades someone's privacy or would cause them distress, alarm,
                  or reputational harm;
                </li>
                <li>
                  attempts to bypass, probe, or interfere with our safety
                  systems, the AI models, or the operation of the Service.
                </li>
              </ul>
              <p className="text-keeper-body leading-relaxed mt-4">
                We use automated and manual checks and{" "}
                <strong>may refuse, block, or remove</strong> any request or
                content that we reasonably believe breaches these Terms, and may
                decline to generate certain cards. These checks are not perfect
                and do not transfer responsibility for Your Content to us.
              </p>
            </section>

            {/* ── 7. Intellectual property ────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                7. Intellectual property
              </h2>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                7.1 Your finished card
              </h3>
              <p className="text-keeper-body leading-relaxed mb-4">
                When you have paid for a card, we grant you a licence to use that
                finished card — the generated artwork together with your message
                — for your own personal, non-commercial purposes (such as sending
                it, keeping it, or printing it). Because it is created partly by
                AI, the extent of any copyright in AI-generated artwork can be
                uncertain; we do not claim to guarantee that the artwork is
                protectable or exclusive to you, and similar artwork could be
                produced for others. If you want to use a card commercially,
                contact us first.
              </p>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                7.2 Our intellectual property
              </h3>
              <p className="text-keeper-body leading-relaxed">
                The Service itself — including the {CONTROLLER.tradingAs} name and
                branding, the website, software, designs, templates and the
                prompts and systems behind the AI generation — belongs to us or
                our licensors and is protected by law. You may not copy, resell,
                reverse-engineer, or exploit any part of the Service except as
                these Terms allow.
              </p>
            </section>

            {/* ── 8. Orders, pricing & payment ────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                8. Orders, pricing and payment
              </h2>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  Prices are shown at checkout in pounds sterling (GBP) and, where
                  applicable, include VAT. Any delivery charge for printed cards
                  is shown before you pay.
                </li>
                <li>
                  A contract is formed when we confirm your order after successful
                  payment. Until then, no contract exists and we may decline an
                  order (for example, if content breaches these Terms or an
                  obvious pricing error has occurred).
                </li>
                <li>
                  Payment is taken through our payment provider, Stripe, on their
                  secure systems. We do not receive or store your full card
                  details.
                </li>
                <li>
                  If a price is displayed incorrectly due to an obvious error, we
                  will let you know and you can confirm the correct price or
                  cancel that order.
                </li>
              </ul>
            </section>

            {/* ── 9. Cancellation & refunds ───────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                9. Your right to cancel, and refunds
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                Your legal rights as a consumer are important and are not affected
                by anything in these Terms.
              </p>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                9.1 Personalised cards
              </h3>
              <p className="text-keeper-body leading-relaxed mb-4">
                {CONTROLLER.tradingAs} cards are made to your specification and
                personalised to you. Under the Consumer Contracts Regulations
                2013, the usual 14-day right to change your mind{" "}
                <strong>does not apply</strong> to goods that are bespoke or
                clearly personalised. This means that once you approve and pay for
                a personalised printed card and we begin producing it, it cannot
                be cancelled simply because you have changed your mind.
              </p>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                9.2 Digital cards
              </h3>
              <p className="text-keeper-body leading-relaxed mb-4">
                For digital cards, you ask us to make your card available to you
                immediately after payment. By placing the order you consent to
                immediate supply and acknowledge that you therefore lose the
                14-day right to cancel once supply has begun.
              </p>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                9.3 If something is wrong
              </h3>
              <p className="text-keeper-body leading-relaxed mb-4">
                None of the above affects your statutory rights under the Consumer
                Rights Act 2015. Your card must be as described, of satisfactory
                quality, and fit for purpose. If a card arrives faulty, damaged,
                misprinted, materially different from what you approved, or a
                digital card fails to deliver or display, you are entitled to a
                remedy — normally a free replacement or a refund. Please contact
                us at {CONTROLLER.contactEmail} within a reasonable time (and, for
                a damaged printed card, ideally within 14 days of delivery) with
                your order details and a photo where relevant, and we will put it
                right.
              </p>
              <h3 className="text-xl font-medium text-keeper-ink mb-3">
                9.4 Failed generations
              </h3>
              <p className="text-keeper-body leading-relaxed">
                You are never charged for simply generating or previewing a card —
                you only pay when you order. If a technical failure on our side
                prevents us from delivering a card you have paid for, we will
                re-attempt it or refund you.
              </p>
            </section>

            {/* ── 10. Delivery ────────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                10. Delivery
              </h2>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  <strong>Digital cards</strong> are made available by email or a
                  shareable link shortly after your order, usually within a few
                  minutes.
                </li>
                <li>
                  <strong>Printed cards</strong> are produced and posted by our
                  print-and-delivery partner. Any delivery timescales shown are
                  estimates, not guarantees, and can be affected by the carrier.
                </li>
                <li>
                  You are responsible for providing a correct and complete
                  delivery address. We cannot be responsible for non-delivery
                  caused by an incorrect address you supplied.
                </li>
                <li>
                  Risk in a printed card passes to you (or your recipient) on
                  delivery. If an item is lost or arrives damaged, contact us and
                  we will help resolve it.
                </li>
              </ul>
            </section>

            {/* ── 11. Emails & reminders ──────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                11. Emails and reminders
              </h2>
              <p className="text-keeper-body leading-relaxed">
                We send service emails relating to your account, cards and orders
                (for example, sign-in codes and order updates). If you save people
                and dates, we may send occasion reminders to help you. You can opt
                out of reminders and non-essential emails at any time; we will
                still send essential messages needed to provide the Service.
              </p>
            </section>

            {/* ── 12. Availability ────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                12. Availability of the Service
              </h2>
              <p className="text-keeper-body leading-relaxed">
                We aim to keep the Service running smoothly but cannot guarantee
                it will always be available or uninterrupted. We may update,
                suspend, or withdraw features, or carry out maintenance, and the
                Service continues to develop and improve over time. We will try to
                give notice of significant planned disruption where we reasonably
                can.
              </p>
            </section>

            {/* ── 13. Liability ───────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                13. Our responsibility to you
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                <strong>
                  We do not exclude or limit our liability where it would be
                  unlawful to do so.
                </strong>{" "}
                This includes liability for death or personal injury caused by our
                negligence, for fraud or fraudulent misrepresentation, and for
                your statutory rights as a consumer, which remain fully intact.
              </p>
              <p className="text-keeper-body leading-relaxed mb-4">
                Subject to that, and because the Service is a low-cost consumer
                product:
              </p>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  we are not liable for losses that were not reasonably
                  foreseeable, or that arise from your own breach of these Terms
                  or from content you provided (including your responsibility for
                  photos and permissions);
                </li>
                <li>
                  we are not liable for business losses — the Service is provided
                  for personal, non-commercial use; and
                </li>
                <li>
                  our total liability arising from or in connection with any order
                  is limited to the amount you paid for that order (or, where no
                  payment was made, to £50).
                </li>
              </ul>
              <p className="text-keeper-body leading-relaxed mt-4">
                Other than as set out in these Terms and as required by law, the
                Service and AI-generated content are provided "as is" without
                further warranties.
              </p>
            </section>

            {/* ── 14. Indemnity ───────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                14. Your responsibility to us
              </h2>
              <p className="text-keeper-body leading-relaxed">
                If you use the Service in breach of these Terms — for example by
                uploading content you did not have the right to use — you agree to
                be responsible for reasonable losses, claims and costs we suffer as
                a direct result. This does not apply to the extent the loss was
                our fault, and nothing in this section requires you to pay more
                than the law allows for a consumer.
              </p>
            </section>

            {/* ── 15. Suspension & termination ────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                15. Suspension and closing your account
              </h2>
              <p className="text-keeper-body leading-relaxed mb-4">
                You can stop using the Service and delete your cards or account at
                any time. Deleting a card removes its images and details from our
                storage; see our Privacy Policy for how deletion and retention
                work.
              </p>
              <p className="text-keeper-body leading-relaxed">
                We may suspend or end your access if you seriously or repeatedly
                breach these Terms, or where we reasonably need to protect the
                Service, other users, or third parties. Where it is fair to do so,
                we will give you notice first. Ending your access does not affect
                orders already accepted, which we will still honour unless the law
                or these Terms allow otherwise.
              </p>
            </section>

            {/* ── 16. Changes to these Terms ──────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                16. Changes to these Terms
              </h2>
              <p className="text-keeper-body leading-relaxed">
                We may update these Terms from time to time — for example to
                reflect new features or changes in the law. The version that
                applies to an order is the one in force when you place it. If we
                make a significant change, we will update the date above and,
                where appropriate, notify you. Continuing to use the Service after
                a change means you accept the updated Terms.
              </p>
            </section>

            {/* ── 17. Governing law ───────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                17. Governing law and disputes
              </h2>
              <p className="text-keeper-body leading-relaxed">
                These Terms and any dispute relating to them or the Service are
                governed by the law of {CONTROLLER.jurisdiction}, and the courts
                of {CONTROLLER.jurisdiction} will have jurisdiction. If you are a
                consumer living elsewhere in the UK, you keep the benefit of any
                mandatory protections and the right to bring proceedings in the
                courts of the part of the UK where you live. We hope to resolve
                any concern directly first, so please contact us at{" "}
                {CONTROLLER.contactEmail}.
              </p>
            </section>

            {/* ── 18. General ─────────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                18. General
              </h2>
              <ul className="list-disc pl-6 text-keeper-body space-y-2">
                <li>
                  <strong>Whole agreement:</strong> these Terms and our Privacy
                  Policy are the entire agreement between us about the Service.
                </li>
                <li>
                  <strong>Severability:</strong> if any part is found invalid, the
                  rest continues to apply.
                </li>
                <li>
                  <strong>No waiver:</strong> if we don't enforce a right
                  immediately, we can still enforce it later.
                </li>
                <li>
                  <strong>Transfer:</strong> you may not transfer your rights under
                  these Terms without our consent; we may transfer ours if your
                  rights are not affected.
                </li>
                <li>
                  <strong>Third parties:</strong> no one other than you and us has
                  any rights under these Terms.
                </li>
              </ul>
            </section>

            {/* ── 19. Contact ─────────────────────────────────────── */}
            <section>
              <h2 className="font-display text-2xl font-semibold text-keeper-ink mb-4">
                19. Contact us
              </h2>
              <div className="text-keeper-body leading-relaxed">
                <p className="mb-2">
                  Questions about these Terms or your order? Get in touch:
                </p>
                <div className="bg-brand-muted/30 p-4 rounded-lg">
                  <p>
                    <strong>{CONTROLLER.legalName}</strong> (trading as{" "}
                    {CONTROLLER.tradingAs})
                  </p>
                  <p>{CONTROLLER.address}</p>
                  <p>Email: {CONTROLLER.contactEmail}</p>
                  <p>Website: {CONTROLLER.website}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
}
