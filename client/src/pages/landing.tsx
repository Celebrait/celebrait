import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Sparkles, Gift } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-pink-500" />
            <span className="text-2xl font-bold text-gray-800">Celebrait</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-pink-500 hover:bg-pink-600"
          >
            Sign In to Create Cards
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Create Beautiful AI-Powered
            <span className="text-pink-500 block">Greeting Cards</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Transform your special moments into personalized greeting cards using the power of AI. 
            Choose from digital delivery or premium printed cards shipped to your door.
          </p>

          <Button 
            onClick={() => window.location.href = '/api/login'}
            size="lg"
            className="bg-pink-500 hover:bg-pink-600 text-lg px-8 py-4 mb-12"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Start Creating Cards
          </Button>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-3">AI-Powered Design</h3>
                <p className="text-gray-600">
                  Our advanced AI creates unique, personalized cards based on your story and preferences.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <Gift className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-3">Multiple Delivery Options</h3>
                <p className="text-gray-600">
                  Choose instant digital delivery or premium printed cards shipped worldwide.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <Heart className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-3">Personal & Meaningful</h3>
                <p className="text-gray-600">
                  Every card tells your unique story with personalized messages and imagery.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="mt-16 p-8 bg-white rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Ready to Create Something Special?
            </h2>
            <p className="text-gray-600 mb-6">
              Sign in with your account to start creating personalized greeting cards. 
              Your cards will be saved to your account whether you purchase or not.
            </p>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-lg px-8 py-4"
            >
              Sign In & Start Creating
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}