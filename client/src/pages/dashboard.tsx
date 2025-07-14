import { useAuth, logout } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/header";
import { Link } from "wouter";
import { 
  PlusCircle, 
  CreditCard, 
  Package, 
  Calendar, 
  Mail, 
  LogOut,
  Heart,
  ImageIcon,
  Download,
  Eye
} from "lucide-react";
import { format } from 'date-fns';

interface DashboardCard {
  id: number;
  cardType: string;
  printOption: string;
  sceneType: string;
  conversationData: any;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  status: string;
  price: number;
  createdAt: string;
}

interface DashboardOrder {
  id: number;
  cardId: number;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: cards, isLoading: cardsLoading } = useQuery<DashboardCard[]>({
    queryKey: ['/api/cards/user', user?.id],
    enabled: !!user?.id,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<DashboardOrder[]>({
    queryKey: ['/api/orders/user', user?.email],
    enabled: !!user?.email,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Please sign in to access your dashboard</p>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                  Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getRecipientName = (conversationData: any) => {
    if (!conversationData) return 'Unknown';
    
    try {
      const data = typeof conversationData === 'string' 
        ? JSON.parse(conversationData) 
        : conversationData;
      
      return data.recipientName || data.name || 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const getCelebration = (conversationData: any) => {
    if (!conversationData) return 'Celebration';
    
    try {
      const data = typeof conversationData === 'string' 
        ? JSON.parse(conversationData) 
        : conversationData;
      
      return data.celebration || 'Celebration';
    } catch {
      return 'Celebration';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.firstName || user?.email}!
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your cards and orders
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/create-card">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create New Card
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Heart className="h-8 w-8 text-pink-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Cards</p>
                  <p className="text-2xl font-bold">{cards?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Orders</p>
                  <p className="text-2xl font-bold">{orders?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold">
                    R{orders?.reduce((sum, order) => sum + order.amount, 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Member Since</p>
                  <p className="text-2xl font-bold">
                    {user?.createdAt ? format(new Date(user.createdAt), 'MMM yyyy') : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Your Cards</h2>
          {cardsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : cards && cards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => (
                <Card key={card.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {getRecipientName(card.conversationData)}'s {getCelebration(card.conversationData)}
                      </CardTitle>
                      <Badge variant={card.status === 'completed' ? 'default' : 'secondary'}>
                        {card.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {card.cardType === 'digital' ? 'Digital' : 'Printed'}
                        </span>
                      </div>
                      <span className="text-sm font-medium">R{card.price}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Print Option:</span>
                        <span className="text-sm">{card.printOption}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Scene Type:</span>
                        <span className="text-sm">{card.sceneType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="text-sm">{format(new Date(card.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Link href={`/card-preview/${card.id}`}>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      {card.cardType === 'digital' && (
                        <Button variant="outline" size="sm" className="flex-1">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No cards created yet</p>
                <Link href="/create-card">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    Create Your First Card
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Orders */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Recent Orders</h2>
          {ordersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <Package className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Order #{order.id}</p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(order.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{order.currency} {order.amount}</p>
                        <Badge variant={order.paymentStatus === 'COMPLETED' ? 'default' : 'secondary'}>
                          {order.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No orders yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}