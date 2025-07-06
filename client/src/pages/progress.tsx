import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressList } from '@/components/progress-manager';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';
import { ArrowLeft, Clock, User } from 'lucide-react';
import AuthModal from '@/components/auth/auth-modal';

export default function ProgressPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUser, setAuthUser] = useState<{firstName: string, lastName: string, email: string} | null>(null);

  // Handle authentication success
  const handleAuthSuccess = (userData: {firstName: string, lastName: string, email: string}) => {
    setAuthUser(userData);
    setShowAuthModal(false);
  };

  // Handle loading progress
  const handleLoadProgress = (progress: any) => {
    // Navigate to the appropriate page based on the progress
    if (progress.currentStep === 'onboarding') {
      window.location.href = '/';
    } else if (progress.currentStep === 'conversation') {
      window.location.href = '/?resume=true';
    } else {
      window.location.href = '/';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const currentUser = user || authUser;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Your Progress</h1>
            </div>
            
            {!currentUser && (
              <Button onClick={() => setShowAuthModal(true)}>
                <User className="w-4 h-4 mr-2" />
                Sign In to View Progress
              </Button>
            )}
          </div>

          {/* Main Content */}
          {!currentUser ? (
            <Card className="text-center py-12">
              <CardContent>
                <Clock className="w-16 h-16 mx-auto mb-6 text-gray-400" />
                <h2 className="text-xl font-semibold mb-4">Sign In to Access Your Progress</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Sign in to view and resume your saved card creation sessions. 
                  Your progress is automatically saved as you work.
                </p>
                <Button onClick={() => setShowAuthModal(true)} size="lg">
                  <User className="w-5 h-5 mr-2" />
                  Sign In
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Welcome Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Welcome back, {currentUser.firstName}!
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Here are your saved card creation sessions. Click on any session to resume where you left off.
                  </p>
                </CardContent>
              </Card>

              {/* Progress List */}
              <Card>
                <CardHeader>
                  <CardTitle>Saved Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProgressList 
                    userId={currentUser.email} 
                    onLoadProgress={handleLoadProgress}
                  />
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-blue-900 mb-2">How Progress Saving Works</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Your progress is automatically saved as you create cards</li>
                    <li>• Resume any session by clicking on it above</li>
                    <li>• Sessions include your conversation history and uploaded photos</li>
                    <li>• Create multiple cards and switch between them anytime</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Start New Card Button */}
          <div className="text-center mt-8">
            <Link href="/">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                Create New Card
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}