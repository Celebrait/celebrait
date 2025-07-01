import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import Header from "@/components/header";
import { apiRequest } from "@/lib/queryClient";

export default function TestDeliveryFlow() {
  const [, setLocation] = useLocation();
  const [isCreating, setIsCreating] = useState(false);

  const createMockCard = async () => {
    setIsCreating(true);
    try {
      // Create a mock card with test data
      const mockCard = await apiRequest({
        method: "POST",
        endpoint: "/api/cards",
        body: {
          userId: 1, // Mock user ID
          cardType: "printed",
          printOption: "front-and-inside",
          conversationData: {
            celebration: "birthday",
            recipient: "friend",
            name: "Test Person",
            message: "Happy Birthday!",
            inside_message: "Hope you have an amazing day filled with joy and laughter!",
            art_style: "watercolor",
            scene: "A beautiful garden party with balloons and cake"
          },
          price: 12900 // $129 in cents
        }
      });

      console.log("Mock card created:", mockCard);
      
      // Redirect to delivery choice with the new card ID
      setLocation(`/delivery-choice/${mockCard.id}`);
    } catch (error) {
      console.error("Error creating mock card:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border-purple-200 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Test Delivery Flow
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Skip card generation and test the delivery, payment, and fulfillment flow
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">What this does:</h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• Creates a mock card with sample data</li>
                  <li>• Takes you to the delivery choice screen</li>
                  <li>• Allows testing printed vs digital delivery</li>
                  <li>• Test delivery details and payment forms</li>
                  <li>• Experience the complete checkout flow</li>
                </ul>
              </div>

              <div className="text-center">
                <Button
                  onClick={createMockCard}
                  disabled={isCreating}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Creating Mock Card...
                    </>
                  ) : (
                    <>
                      Start Delivery Flow Test
                      <ArrowRight className="w-5 h-5 ml-3" />
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>Mock card will be created with sample birthday card data</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}