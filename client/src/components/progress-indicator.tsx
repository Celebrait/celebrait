interface ProgressIndicatorProps {
  currentStep: number;
}

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const percentage = (currentStep / 4) * 100;

  return (
    <div className="mb-8">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-gradient-celebrait h-2 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
