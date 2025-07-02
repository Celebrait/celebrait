import Header from "@/components/header";
import Footer from "@/components/footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="backdrop-blur-sm bg-white/80 rounded-2xl border border-white/50 shadow-xl p-8 lg:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Terms of Service</h1>
          
          <div className="prose prose-gray max-w-none space-y-8">
            <div className="text-sm text-gray-600 mb-8">
              <p><strong>Last updated:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Effective date:</strong> {new Date().toLocaleDateString()}</p>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms of Service ("Terms") constitute a legally binding agreement between you and Wezign Media (PTY) LTD, 
                trading as Celebrait.co.za ("Company", "we", "our", or "us"), regarding your use of our website www.celebrait.co.za 
                and our AI-powered greeting card generation services ("Service").
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Acceptance of Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                By accessing or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, 
                you may not access or use our Service. These Terms apply to all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Description of Service</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Celebrait.co.za provides an AI-powered platform for creating personalized greeting cards. Our services include:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>AI-generated custom greeting card creation</li>
                <li>Digital card delivery via email</li>
                <li>Physical card printing and shipping services</li>
                <li>Payment processing through secure third-party providers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. User Accounts and Registration</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                While account creation is not required for basic services, you may need to provide certain information to use specific features. You agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain the security of any account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Acceptable Use</h2>
              <p className="text-gray-700 leading-relaxed mb-4">You agree not to use our Service to:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Create content that is illegal, harmful, offensive, or violates any laws</li>
                <li>Upload images that violate copyright or intellectual property rights</li>
                <li>Generate content that is defamatory, discriminatory, or hateful</li>
                <li>Attempt to reverse engineer or exploit our AI systems</li>
                <li>Use the Service for commercial purposes without authorization</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Violate any applicable local, state, national, or international law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Content and Intellectual Property</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">6.1 Your Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                You retain ownership of any photos, text, or other content you provide. By using our Service, you grant us 
                a limited license to use your content solely for the purpose of generating and delivering your greeting cards.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">6.2 Generated Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                AI-generated images and content created through our Service are provided for your personal use. 
                You may not resell, redistribute, or commercially exploit generated content without explicit permission.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">6.3 Our Intellectual Property</h3>
              <p className="text-gray-700 leading-relaxed">
                The Service, including its design, functionality, and technology, is owned by Wezign Media (PTY) LTD 
                and is protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Payments and Billing</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">7.1 Pricing</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Current pricing is displayed on our website. Prices are subject to change with notice. 
                Digital cards and printed cards have different pricing structures.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">7.2 Payment Processing</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payments are processed through secure third-party providers (Stripe, Paystack). 
                We do not store your payment information on our servers.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">7.3 Refunds</h3>
              <p className="text-gray-700 leading-relaxed">
                Due to the personalized nature of our AI-generated cards, refunds are generally not available once 
                generation has begun. Refunds may be considered for technical issues or service failures on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Delivery and Fulfillment</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">8.1 Digital Delivery</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Digital cards are delivered via email once generation is complete. 
                Delivery times vary but typically occur within 2-5 minutes of order completion.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">8.2 Physical Delivery</h3>
              <p className="text-gray-700 leading-relaxed">
                Printed cards are fulfilled through third-party printing partners. 
                Shipping times and costs vary by location and shipping method selected. 
                We are not responsible for delays caused by printing partners or shipping carriers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Privacy and Data Protection</h2>
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. Please review our Privacy Policy, which explains how we collect, 
                use, and protect your information when you use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Disclaimers and Limitations</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">10.1 Service Availability</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We strive to maintain service availability but do not guarantee uninterrupted access. 
                The Service may be temporarily unavailable due to maintenance, updates, or technical issues.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">10.2 AI-Generated Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                AI-generated content may not always meet your expectations. We do not guarantee the accuracy, 
                quality, or suitability of generated content for any particular purpose.
              </p>

              <h3 className="text-xl font-medium text-gray-800 mb-3">10.3 Limitation of Liability</h3>
              <p className="text-gray-700 leading-relaxed">
                To the maximum extent permitted by law, Wezign Media (PTY) LTD shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify and hold harmless Wezign Media (PTY) LTD from any claims, damages, or expenses 
                arising from your use of the Service, violation of these Terms, or infringement of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Termination</h2>
              <p className="text-gray-700 leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice, 
                for any reason, including breach of these Terms. Upon termination, your right to use the Service ceases immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms are governed by and construed in accordance with the laws of South Africa. 
                Any disputes arising from these Terms or your use of the Service shall be subject to the 
                exclusive jurisdiction of the courts of South Africa.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of material changes 
                by posting the updated Terms on our website. Continued use of the Service after changes constitutes 
                acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Severability</h2>
              <p className="text-gray-700 leading-relaxed">
                If any provision of these Terms is held to be invalid or unenforceable, 
                the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Contact Information</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-2">For questions about these Terms, please contact us:</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Wezign Media (PTY) LTD</strong></p>
                  <p>Trading as: Celebrait.co.za</p>
                  <p>Email: legal@celebrait.co.za</p>
                  <p>Website: www.celebrait.co.za</p>
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