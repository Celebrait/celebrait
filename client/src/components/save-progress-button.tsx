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
              <Save className="w-5 h-5 text-blue-500" />
              Save Your Progress?
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              <p>We'll save your progress and email you a secure link to continue creating your card from exactly where you left off.</p>
              <p>Perfect for taking a break and returning later to finish your personalized greeting card.</p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              onClick={() => setShowConfirmDialog(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmSaveProgress}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Progress & Return Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}