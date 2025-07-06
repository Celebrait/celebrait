import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Simple skeleton component placeholder
import { AlertCircle, Plus, ArrowLeft, LogIn } from 'lucide-react';
import { useGetSavedProgress, SavedProgress } from '@/hooks/use-save-progress';
import SavedProgressCard from '@/components/saved-progress-card';
import { useOnboarding } from '@/hooks/use-onboarding';
import Header from '@/components/header';
import Footer from '@/components/footer';
import AuthModal from '@/components/auth/auth-modal';

export default function SavedProgressPage() {
  const [, setLocation] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const onboarding = useOnboarding();
  const { data: savedProgress, isLoading, error } = useGetSavedProgress(authenticatedUser?.id);

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkExistingAuth = () => {
      try {
        // Check if there's stored auth data in sessionStorage
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('Found stored authentication:', userData);
          setAuthenticatedUser(userData);
        }
      } catch (error) {
        console.error('Error checking stored authentication:', error);
      } finally {
        setAuthCheckComplete(true);
      }
    };

    checkExistingAuth();
  }, []);

  // Show loading state while checking authentication
  if (!authCheckComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600">Checking authentication...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleContinueProgress = (progressData: SavedProgress) => {
    try {
      console.log('Continuing progress with data:', progressData);
      
      // Restore the onboarding state from saved progress
      onboarding.setSelectedDelivery(progressData.cardType as 'printed' | 'digital');
      
      // Restore conversation data if available
      if (progressData.conversationData?.answers) {
        // This would require extending the onboarding hook to restore full state
        // For now, we'll navigate to the conversation with the saved data
      }

      // Navigate to home with the saved state data
      // Store the saved progress data in session storage for the home page to use
      sessionStorage.setItem('resumeFromSaved', 'true');
      sessionStorage.setItem('savedProgressData', JSON.stringify(progressData));
      sessionStorage.setItem('selectedDeliveryType', progressData.cardType);
      
      // Navigate to home page which will handle the restoration
      setLocation('/');
    } catch (error) {
      console.error('Error resuming progress:', error);
    }
  };

  const handleAuthSuccess = (userData: { id: string; firstName: string; lastName: string; email: string }) => {
    setShowAuthModal(false);
    
    // Store authentication data in sessionStorage for persistence
    sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
    console.log('Stored authentication data on saved progress page:', userData);
    
    setAuthenticatedUser(userData);
  };

  const handleStartNewCard = () => {
    // Clear any saved progress session data and navigate to home
    sessionStorage.removeItem('resumeFromSaved');
    sessionStorage.removeItem('savedProgressData');
    sessionStorage.removeItem('selectedDeliveryType');
    setLocation('/');
  };

  if (!authenticatedUser && authCheckComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                  <h2 className="text-xl font-semibold text-gray-900">Sign In Required</h2>
                  <p className="text-gray-600">
                    Please sign in to view your saved card creation progress.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      onClick={() => {
                        console.log('Sign In to Continue button clicked!');
                        setShowAuthModal(true);
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In to Continue
                    </Button>
                    <Button 
                      onClick={() => setLocation('/')}
                      variant="outline"
                      className="w-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Home
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // At this point, we know authenticatedUser is not null due to the early return above
  const user = authenticatedUser!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-gray-600">
              Continue where you left off or start creating a new card
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="h-48 w-full rounded-lg bg-gray-200 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <h3 className="text-lg font-semibold text-gray-900">Unable to Load Progress</h3>
                  <p className="text-gray-600">
                    We couldn't load your saved progress. Please try again or start a new card.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Progress Found */}
          {savedProgress && !isLoading && (
            <div className="space-y-6">
              <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <CardHeader>
                  <CardTitle className="text-xl">Continue Your Card</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    You have unfinished card creation progress. Pick up where you left off!
                  </p>
                </CardContent>
              </Card>

              <SavedProgressCard
                savedProgress={savedProgress}
                onContinue={handleContinueProgress}
              />
            </div>
          )}

          {/* No Saved Progress */}
          {!savedProgress && !isLoading && !error && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Plus className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">No Saved Progress</h3>
                  <p className="text-gray-600">
                    You don't have any saved card creation progress yet. Start creating your first card!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button
              onClick={handleStartNewCard}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-3"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Card
            </Button>
            
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
              className="flex-1 py-3"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>

      <Footer />
      
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
        mode="saveProgress"
      />
    </div>
  );
}