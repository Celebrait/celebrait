import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';
import { useSaveProgress, SaveProgressData } from '@/hooks/use-save-progress';
import AuthModal from '@/components/auth/auth-modal';

interface SaveProgressButtonProps {
  progressData: Omit<SaveProgressData, 'userId'>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  authenticatedUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  onUserAuthenticated?: (userData: { firstName: string; lastName: string; email: string }) => void;
}

export default function SaveProgressButton({ 
  progressData, 
  variant = 'default', 
  size = 'default',
  className = '',
  authenticatedUser,
  onUserAuthenticated
}: SaveProgressButtonProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { saveProgress, isLoading } = useSaveProgress();

  const handleSaveProgress = () => {
    if (!authenticatedUser) {
      // Show authentication modal
      setShowAuthModal(true);
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmSaveProgress = () => {
    if (!authenticatedUser) return;

    saveProgress({
      userId: authenticatedUser.id,
      ...progressData
    });
    setShowConfirmDialog(false);
  };

  const handleAuthSuccess = (userData: { firstName: string; lastName: string; email: string }) => {
    setShowAuthModal(false);
    if (onUserAuthenticated) {
      onUserAuthenticated(userData);
    }
    // After authentication, show the save confirmation
    setTimeout(() => setShowConfirmDialog(true), 500);
  };

  return (
    <>
      <Button
        onClick={handleSaveProgress}
        variant={variant}
        size={size}
        className={className}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Save Progress & Return Later
      </Button>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onAuthSuccess={handleAuthSuccess}
      />

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-purple-500" />
              Continue Your Journey Later?
            </DialogTitle>
            <DialogDescription className="text-left space-y-3">
              <p>Take a break from creating your card - we'll save everything and send you a personalized email link to pick up exactly where you left off.</p>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-800">What happens next:</p>
                <ul className="text-sm text-purple-700 mt-1 space-y-1">
                  <li>• Your conversation progress gets saved</li>
                  <li>• You'll receive an email with a secure link</li>
                  <li>• Click the link anytime to continue creating</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              onClick={() => setShowConfirmDialog(false)}
              variant="outline"
              className="flex-1"
            >
              Keep Creating
            </Button>
            <Button 
              onClick={confirmSaveProgress}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save & Email Me Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}