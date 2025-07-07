import { Link } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Welcome to Celebrait
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create personalized AI-powered greeting cards for your loved ones.
          </p>

          <div className="space-y-4">
            <p className="text-gray-500">
              This is a placeholder landing page. You can customize this however you'd like.
            </p>
            
            <Link to="/create-card">
              <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-lg">
                Start Creating Your Card
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}