import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LovedOne {
  name: string;
  birthday: string;
}

interface SignupModalProps {
  onSignupComplete: () => void;
  onClose: () => void;
}

export default function SignupModal({ onSignupComplete, onClose }: SignupModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lovedOnes, setLovedOnes] = useState<LovedOne[]>([{ name: "", birthday: "" }]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addLovedOne = () => {
    if (lovedOnes.length < 5) {
      setLovedOnes([...lovedOnes, { name: "", birthday: "" }]);
    }
  };

  const updateLovedOne = (index: number, field: 'name' | 'birthday', value: string) => {
    const updated = lovedOnes.map((person, i) => 
      i === index ? { ...person, [field]: value } : person
    );
    setLovedOnes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Filter out empty loved ones
      const validLovedOnes = lovedOnes.filter(person => person.name.trim() && person.birthday);
      
      await apiRequest("POST", "/api/users", {
        username: name,
        email,
        lovedOnes: validLovedOnes
      });

      toast({
        title: "Welcome to Celebrait!",
        description: `You've saved R${validLovedOnes.length * 5} with ${validLovedOnes.length} loved ones added!`,
      });

      onSignupComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validLovedOnes = lovedOnes.filter(person => person.name.trim() && person.birthday);
  const savings = validLovedOnes.length * 5;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-white rounded-3xl p-0 overflow-hidden">
        <div className="p-8">
          <DialogHeader className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-celebrait rounded-full mx-auto mb-4 flex items-center justify-center">
              <Users className="text-white text-2xl" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-800 mb-2">
              Join the Celebrait Family! 👨‍👩‍👧‍👦
            </DialogTitle>
            <p className="text-slate-gray">Your card is almost ready! Sign up to view and download it.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:border-ethereal-purple transition-all duration-300"
                required
              />
            </div>
            
            <div>
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:border-ethereal-purple transition-all duration-300"
                required
              />
            </div>

            {/* Marketing Promotion */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 border-2 border-yellow-200">
              <h4 className="font-bold text-gray-800 mb-2">🎁 Special Offer: Get R5 off per loved one!</h4>
              <p className="text-sm text-gray-700 mb-3">
                Add up to 5 loved ones' birthdays and get R5 off each future card! 
                We'll remind you when their special days are coming up.
              </p>
              
              <div className="space-y-2">
                {lovedOnes.map((person, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      placeholder="Name"
                      value={person.name}
                      onChange={(e) => updateLovedOne(index, 'name', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-ethereal-purple"
                    />
                    <Input
                      type="date"
                      value={person.birthday}
                      onChange={(e) => updateLovedOne(index, 'birthday', e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-ethereal-purple"
                    />
                  </div>
                ))}
              </div>
              
              {lovedOnes.length < 5 && (
                <Button
                  type="button"
                  onClick={addLovedOne}
                  variant="ghost"
                  className="mt-2 text-yellow-600 hover:text-orange-600 text-sm font-medium p-0"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add another person (R5 off!)
                </Button>
              )}

              {savings > 0 && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    💰 You'll save R{savings} on future cards!
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all duration-300"
            >
              {isLoading ? "Creating account..." : "Join & View My Card 🎨"}
            </Button>
          </form>

          <div className="flex items-center justify-center mt-4 text-xs text-slate-gray">
            <Shield className="w-3 h-3 mr-1" />
            By joining, you agree to our Terms & Privacy Policy. 
            We'll only send you birthday reminders and special offers.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
