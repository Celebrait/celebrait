import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Package, Eye, LogOut, User, Mail } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: userCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['/api/user/cards'],
  });

  const { data: userOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/user/orders'],
  });

  const handleSignOut = () => {
    window.location.href = '/api/logout';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'generating': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />
      
      <div className="pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back{user?.firstName && `, ${user.firstName}`}!
              </h1>
              <p className="text-gray-600">Manage your cards and orders from your dashboard</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/create">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Card
                </Button>
              </Link>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* User Info Card */}
          <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Email:</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="font-medium">
                    {user?.firstName || user?.lastName 
                      ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                      : 'Not provided'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Tabs */}
          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="cards">My Cards ({userCards.length})</TabsTrigger>
              <TabsTrigger value="orders">My Orders ({userOrders.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cards">
              <div className="grid gap-6">
                {cardsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your cards...</p>
                  </div>
                ) : userCards.length === 0 ? (
                  <Card className="text-center py-12 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent>
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Plus className="text-white w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No cards yet</h3>
                      <p className="text-gray-600 mb-6">Create your first personalized greeting card to get started!</p>
                      <Link href="/create">
                        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                          Create Your First Card
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCards.map((card: any) => (
                      <Card key={card.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Card #{card.id}</CardTitle>
                            <Badge className={getStatusColor(card.status)}>
                              {card.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Type:</span>
                              <span className="font-medium capitalize">{card.cardType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Print Option:</span>
                              <span className="font-medium">{card.printOption || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Price:</span>
                              <span className="font-medium">R{(card.price / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Created:</span>
                              <span className="font-medium">
                                {new Date(card.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          {card.status === 'completed' && (
                            <div className="mt-4 flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              {card.cardType === 'digital' && (
                                <Button variant="outline" size="sm" className="flex-1">
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="orders">
              <div className="grid gap-6">
                {ordersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading your orders...</p>
                  </div>
                ) : userOrders.length === 0 ? (
                  <Card className="text-center py-12 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent>
                      <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Package className="text-white w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h3>
                      <p className="text-gray-600 mb-6">Your completed orders will appear here once you place them.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {userOrders.map((order: any) => (
                      <Card key={order.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                            <Badge className={getOrderStatusColor(order.orderStatus)}>
                              {order.orderStatus}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Customer:</span>
                                <span className="font-medium">{order.customerName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Email:</span>
                                <span className="font-medium">{order.customerEmail}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Amount:</span>
                                <span className="font-medium">{order.currency} {(order.amount / 100).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Payment:</span>
                                <span className="font-medium capitalize">{order.paymentStatus}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Order Date:</span>
                                <span className="font-medium">
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {order.trackingNumber && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Tracking:</span>
                                  <span className="font-medium">{order.trackingNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}