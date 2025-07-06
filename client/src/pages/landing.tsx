import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Heart, Wand2, Users } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';

export default function Landing() {
  const handleSignIn = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />
      
      <div className="pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Create Beautiful AI-Powered
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"> Greeting Cards</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your special moments into personalized greeting cards with the power of AI. 
              Sign up to receive your cards via email and access your personal dashboard.
            </p>
            
            <Button 
              onClick={handleSignIn}
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg rounded-full"
            >
              Sign In to Get Started
            </Button>
            
            <p className="text-sm text-gray-500 mt-4">
              Account required to receive card preview links via email
            </p>
          </div>

          {/* Features Section */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Heart className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Personal Touch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI analyzes your photos and creates personalized cards that capture the essence of your special moments.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Wand2 className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">AI Magic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Advanced AI generates stunning artwork and personalized messages tailored to your celebration.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Your Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Access all your cards and orders from your personal dashboard. Track deliveries and create new cards.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="mt-20 text-center bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Create Your First Card?
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Sign up now to access the full card creation experience and receive your cards via email.
            </p>
            <Button 
              onClick={handleSignIn}
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg rounded-full"
            >
              Create Account & Start Designing
            </Button>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}