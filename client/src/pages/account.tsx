import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Package, CreditCard, User, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import Header from "@/components/header";

export default function AccountPage() {
  const { toast } = useToast();
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, userLoading, toast]);

  // Fetch user's cards
  const { data: userCards, isLoading: cardsLoading } = useQuery({
    queryKey: ["/api/my-cards"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch user's orders  
  const { data: userOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/my-orders"],
    enabled: isAuthenticated,
    retry: false,
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your account...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'generating': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8 backdrop-blur-md bg-white/80 border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl">
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || 'Welcome'}
                  </h1>
                  <p className="text-gray-600">{user?.email}</p>
                  <p className="text-sm text-gray-500">
                    Member since {formatDate(user?.createdAt || new Date().toISOString())}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/api/logout'}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Cards */}
          <Card className="backdrop-blur-md bg-white/80 border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-purple-600" />
                <span>My Cards</span>
                <Badge variant="secondary">{userCards?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cardsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : userCards && userCards.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {userCards.map((card: any) => (
                    <div key={card.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Card #{card.id}</p>
                        <p className="text-sm text-gray-600">{card.cardType} • {card.sceneType}</p>
                        <p className="text-xs text-gray-500">
                          Created {formatDate(card.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(card.status)}>{card.status}</Badge>
                        <p className="text-sm font-medium mt-1">R{(card.price / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No cards created yet</p>
                  <Button 
                    onClick={() => window.location.href = '/'}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    Create Your First Card
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className="backdrop-blur-md bg-white/80 border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <span>Order History</span>
                <Badge variant="secondary">{userOrders?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : userOrders && userOrders.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {userOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Order #{order.id}</p>
                        <p className="text-sm text-gray-600">{order.deliveryType}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </p>
                        {order.trackingNumber && (
                          <p className="text-xs text-blue-600">
                            Tracking: {order.trackingNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(order.orderStatus)}>{order.orderStatus}</Badge>
                        <p className="text-sm font-medium mt-1">R{(order.amount / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8 backdrop-blur-md bg-white/80 border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-16"
              >
                <div className="text-center">
                  <Package className="h-6 w-6 mx-auto mb-1" />
                  <span>Create New Card</span>
                </div>
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/my-cards'}
                className="h-16"
              >
                <div className="text-center">
                  <User className="h-6 w-6 mx-auto mb-1" />
                  <span>View All Cards</span>
                </div>
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/support'}
                className="h-16"
              >
                <div className="text-center">
                  <Calendar className="h-6 w-6 mx-auto mb-1" />
                  <span>Get Support</span>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}