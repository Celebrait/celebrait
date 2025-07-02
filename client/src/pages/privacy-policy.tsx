import Header from "@/components/header";
import Footer from "@/components/footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="backdrop-blur-sm bg-white/80 rounded-2xl border border-white/50 shadow-xl p-8 lg:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Privacy Policy</h1>
          
          <div className="prose prose-gray max-w-none space-y-8">
            <div className="text-sm text-gray-600 mb-8">
              <p><strong>Last updated:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Effective date:</strong> {new Date().toLocaleDateString()}</p>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                Wezign Media (PTY) LTD, trading as Celebrait.co.za ("we", "our", or "us"), is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website 
                www.celebrait.co.za and use our AI-powered greeting card generation services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">2.1 Personal Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">We may collect the following personal information:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Name and contact information (email address, phone number)</li>
                <li>Billing and shipping addresses</li>
                <li>Payment information (processed securely through Stripe and Paystack)</li>
                <li>Photos and images you upload for card generation</li>
                <li>Personal details and messages you provide for card customization</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3 mt-6">2.2 Technical Information</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Usage data and analytics</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Generate personalized greeting cards using AI technology</li>
                <li>Process payments and fulfill orders</li>
                <li>Send order confirmations and shipping notifications</li>
                <li>Deliver digital cards via email</li>
                <li>Provide customer support</li>
                <li>Improve our services and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. AI and Image Processing</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use third-party AI services (OpenAI, Replicate) to generate custom greeting cards. 
                Your photos and personal information may be processed by these services to create your cards. 
                We ensure these providers maintain appropriate security measures and data protection standards.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Information Sharing</h2>
              <p className="text-gray-700 leading-relaxed mb-4">We may share your information with:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Payment processors (Stripe, Paystack) for transaction processing</li>
                <li>AI service providers for card generation</li>
                <li>Printing and fulfillment partners for physical card delivery</li>
                <li>Email service providers for notifications</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                We do not sell, trade, or rent your personal information to third parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is 
                completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed">
                We retain your personal information for as long as necessary to provide our services and comply with 
                legal obligations. Generated cards and associated data may be stored to enable reorders and customer support.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">Under applicable data protection laws, you may have the right to:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your personal information</li>
                <li>Restrict processing of your information</li>
                <li>Data portability</li>
                <li>Object to processing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies</h2>
              <p className="text-gray-700 leading-relaxed">
                We use cookies and similar technologies to enhance your experience, analyze usage, and provide 
                personalized content. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Transfers</h2>
              <p className="text-gray-700 leading-relaxed">
                Your information may be transferred to and processed in countries other than South Africa. 
                We ensure appropriate safeguards are in place to protect your information during such transfers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes 
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-2">If you have any questions about this Privacy Policy, please contact us:</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Wezign Media (PTY) LTD</strong></p>
                  <p>Trading as: Celebrait.co.za</p>
                  <p>Email: privacy@celebrait.co.za</p>
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