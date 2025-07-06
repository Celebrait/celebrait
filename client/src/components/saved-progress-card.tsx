import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Trash2, Calendar, Palette } from 'lucide-react';
import { SavedProgress, useSaveProgress } from '@/hooks/use-save-progress';
import { formatDistanceToNow } from 'date-fns';

interface SavedProgressCardProps {
  savedProgress: SavedProgress;
  onContinue: (progressData: SavedProgress) => void;
  onDelete?: (progressId: number) => void;
}

export default function SavedProgressCard({ savedProgress, onContinue, onDelete }: SavedProgressCardProps) {
  const { deleteSavedProgress, isDeletingProgress } = useSaveProgress();

  const handleDelete = () => {
    if (onDelete) {
      onDelete(savedProgress.id);
    } else {
      deleteSavedProgress(savedProgress.id);
    }
  };

  const getStepDescription = (step: number) => {
    switch (step) {
      case 1: return 'Getting started';
      case 2: return 'Choosing delivery method';
      case 3: return 'Selecting photo options';
      case 4: return 'In conversation';
      case 5: return 'Generating card';
      default: return `Step ${step}`;
    }
  };

  const getCardTypeLabel = (cardType: string) => {
    return cardType === 'digital' ? 'Digital Card' : 'Printed Card';
  };

  const getRecipientName = () => {
    try {
      const conversationData = savedProgress.conversationData;
      if (conversationData?.recipientName) {
        return conversationData.recipientName;
      }
      if (conversationData?.answers?.recipientName) {
        return conversationData.answers.recipientName;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getCelebration = () => {
    try {
      const conversationData = savedProgress.conversationData;
      if (conversationData?.celebration) {
        return conversationData.celebration;
      }
      if (conversationData?.answers?.celebration) {
        return conversationData.answers.celebration;
      }
      return null;
    } catch {
      return null;
    }
  };

  const recipientName = getRecipientName();
  const celebration = getCelebration();
  const lastActiveTime = formatDistanceToNow(new Date(savedProgress.lastActiveAt), { addSuffix: true });

  return (
    <Card className="w-full hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {recipientName && celebration ? (
                `${celebration} card for ${recipientName}`
              ) : recipientName ? (
                `Card for ${recipientName}`
              ) : celebration ? (
                `${celebration} card`
              ) : (
                'Greeting Card in Progress'
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium">
                {getCardTypeLabel(savedProgress.cardType)}
              </span>
              {savedProgress.printOption && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-xs font-medium">
                  {savedProgress.printOption === 'front-only' ? 'Front Only' : 'Front & Inside'}
                </span>
              )}
            </div>
          </div>
          
          <Button
            onClick={handleDelete}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-red-500 hover:bg-red-50"
            disabled={isDeletingProgress}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Palette className="w-4 h-4" />
          <span>{getStepDescription(savedProgress.currentStep)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Last updated {lastActiveTime}</span>
        </div>

        <Button 
          onClick={() => onContinue(savedProgress)}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold"
        >
          <PlayCircle className="w-4 h-4 mr-2" />
          Continue Creating
        </Button>
      </CardContent>
    </Card>
  );
}