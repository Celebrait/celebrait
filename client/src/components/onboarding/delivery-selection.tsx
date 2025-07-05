import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Download, Mail, Sparkles } from 'lucide-react';

interface DeliverySelectionProps {
  onDeliverySelected: (delivery: 'printed' | 'digital') => void;
}

export default function DeliverySelection({ onDeliverySelected }: DeliverySelectionProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          How would you like your card?
        </h2>
        <p className="text-gray-600 text-lg">
          Choose your preferred delivery method to get started
        </p>
        
        {/* Clarifying Label */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
          <p className="text-blue-800 text-sm">
            <Sparkles className="w-4 h-4 inline mr-1" />
            You'll create and preview your card before purchasing. You can change your delivery method after seeing your card.
          </p>
        </div>
      </div>

      {/* Delivery Options */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Printed Card Option */}
        <Card 
          onClick={() => onDeliverySelected('printed')}
          className="cursor-pointer border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm"
        >
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800">Printed & Delivered</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              High-quality physical greeting card printed and delivered to your door or directly to the recipient
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>Premium card stock</span>
              </div>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>Professional printing</span>
              </div>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>Fast delivery</span>
              </div>
            </div>
            
            <div className="text-2xl font-bold text-purple-600 mt-4">
              R129.00
            </div>
            
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onDeliverySelected('printed');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-xl font-semibold"
            >
              Choose Printed Card
            </Button>
          </CardContent>
        </Card>

        {/* Digital Card Option */}
        <Card 
          onClick={() => onDeliverySelected('digital')}
          className="cursor-pointer border-2 border-green-200 hover:border-green-400 transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm"
        >
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-4">
              <Download className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800">Digital Download</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Instant digital card delivered via email with interactive viewing and download options
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>Instant delivery</span>
              </div>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>Interactive viewing</span>
              </div>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <span>High-res download</span>
              </div>
            </div>
            
            <div className="text-2xl font-bold text-green-600 mt-4">
              FREE
            </div>
            
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onDeliverySelected('digital');
              }}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Choose Digital Card
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}