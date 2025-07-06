import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  const { saveProgress, isLoading } = useSaveProgress();

  const handleSaveProgress = () => {
    if (!authenticatedUser) {
      // Show authentication modal with save progress mode
      setShowAuthModal(true);
      return;
    }

    // If authenticated, save progress directly
    saveProgress({
      userId: authenticatedUser.id,
      ...progressData
    });
  };

  const handleAuthSuccess = (userData: { firstName: string; lastName: string; email: string }) => {
    setShowAuthModal(false);
    if (onUserAuthenticated) {
      onUserAuthenticated(userData);
    }
    // After authentication, save progress automatically
    setTimeout(() => {
      saveProgress({
        userId: userData.email, // Use email as userId for now
        ...progressData
      });
    }, 500);
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
        mode="saveProgress"
      />
    </>
  );
}