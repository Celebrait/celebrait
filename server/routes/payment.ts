import type { Express } from "express";
import { storage } from "../storage";
import { sendEmail } from "../email-service";
import { generateOrderConfirmationEmail, generateDigitalCardEmail } from "../missing-email-functions";
import { stripe, hasPaystack } from "../utils/shared";

export function registerPaymentRoutes(app: Express): void {
  app.get("/api/orders/reference/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const order = await storage.getOrderByReference(reference);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get the associated card
      const card = await storage.getCard(order.cardId);
      
      res.json({
        ...order,
        card
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });


  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { cardId } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available - Stripe API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: card.price, // Already in cents
        currency: "zar", // South African Rand
        metadata: {
          cardId: cardId.toString()
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });


  app.post("/api/complete-payment", async (req, res) => {
    try {
      const { cardId } = req.body;

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const updatedCard = await storage.updateCard(cardId, {
        status: 'paid'
      });

      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error completing payment: " + error.message });
    }
  });


  app.post("/api/create-payment", async (req, res) => {
    try {
      const { cardId, customerInfo, amount, currency = 'ZAR' } = req.body;

      if (!cardId || !customerInfo || !amount) {
        return res.status(400).json({ message: "Card ID, customer info, and amount are required" });
      }

      const reference = `celebrait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerPhone: customerInfo.phone,
        amount: parseInt(amount),
        currency,
        paymentReference: reference,
        shippingAddress: customerInfo.address || null
      };

      const order = await storage.createOrder(orderData);

      if (!hasPaystack) {
        const mockPaymentUrl = `https://${req.get('host')}/payment-success?reference=${reference}&status=success`;
        return res.json({ 
          paymentUrl: mockPaymentUrl, 
          reference,
          message: "Test mode - payment will be simulated"
        });
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customerInfo.email,
          amount: amount,
          currency,
          reference,
          callback_url: `https://${req.get('host')}/payment-success`,
          metadata: {
            cardId: cardId.toString(),
            orderId: order.id.toString(),
            customerName: orderData.customerName,
            cardType: 'greeting_card'
          }
        })
      });

      const paystackData = await paystackResponse.json();

      if (paystackData.status) {
        res.json({ 
          paymentUrl: paystackData.data.authorization_url, 
          reference,
          accessCode: paystackData.data.access_code
        });
      } else {
        throw new Error(paystackData.message || 'Payment initialization failed');
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment: " + error.message });
    }
  });


  app.post("/api/create-payment-with-tip", async (req, res) => {
    try {
      const { cardId, customerInfo, amount, baseAmount, tipAmount, currency = 'ZAR' } = req.body;

      if (!cardId || !customerInfo || amount === undefined) {
        return res.status(400).json({ message: "Card ID, customer info, and amount are required" });
      }

      const reference = `celebrait_tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerPhone: customerInfo.phone,
        amount: parseInt(amount),
        baseAmount: parseInt(baseAmount),
        tipAmount: parseInt(tipAmount || 0),
        currency,
        paymentReference: reference,
        shippingAddress: customerInfo.address || null,
        orderType: 'paid_with_tip'
      };

      console.log('Creating order with data:', orderData);
      const order = await storage.createOrder(orderData);
      console.log('Order created successfully:', order?.id, 'with reference:', order?.paymentReference);

      // Send order confirmation email
      try {
        const emailParams = generateOrderConfirmationEmail(orderData);
        await sendEmail(emailParams);
        console.log('Order confirmation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Don't fail the entire request if email fails
      }

      if (!order || !order.id) {
        console.error('Order creation failed - no order returned or missing ID');
        return res.status(500).json({ message: "Failed to create order" });
      }

      if (!hasPaystack) {
        const mockPaymentUrl = `https://${req.get('host')}/payment-success?reference=${reference}&status=success`;
        console.log('Generated mock payment URL:', mockPaymentUrl);
        return res.json({ 
          paymentUrl: mockPaymentUrl, 
          reference,
          message: "Test mode - payment with tip will be simulated"
        });
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customerInfo.email,
          amount: amount,
          currency,
          reference,
          callback_url: `https://${req.get('host')}/payment-success`,
          metadata: {
            cardId: cardId.toString(),
            orderId: order.id.toString(),
            customerName: orderData.customerName,
            cardType: 'greeting_card',
            baseAmount: baseAmount.toString(),
            tipAmount: (tipAmount || 0).toString(),
            orderType: 'paid_with_tip'
          }
        })
      });

      const paystackData = await paystackResponse.json();

      if (paystackData.status) {
        res.json({ 
          paymentUrl: paystackData.data.authorization_url, 
          reference,
          accessCode: paystackData.data.access_code
        });
      } else {
        throw new Error(paystackData.message || 'Payment initialization failed');
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment with tip: " + error.message });
    }
  });


  app.post("/api/create-free-order", async (req, res) => {
    return res.status(400).json({
      message: "Payment is not yet configured",
      requiresPayment: true,
      redirectToPayment: true
    });
  });


  app.post("/api/verify-payment", async (req, res) => {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({ message: "Payment reference is required" });
      }

      console.log('Verifying payment for reference:', reference);

      const order = await storage.getOrderByReference(reference);
      if (!order) {
        console.log('Order not found for reference:', reference);
        return res.status(404).json({ message: "Order not found for reference: " + reference });
      }

      console.log('Found order:', order.id, 'for reference:', reference);

      if (!hasPaystack) {
        // Get card to determine order status based on type
        const card = await storage.getCard(order.cardId);
        const isDigital = !order.shippingAddress;

        const updatedOrder = await storage.updateOrder(order.id, {
          paymentStatus: 'successful',
          orderStatus: isDigital ? 'completed' : 'processing'
        });

        // Update card status to paid
        if (card) {
          await storage.updateCard(card.id, { status: 'paid' });

          // Send appropriate email based on order type
          try {
            if (isDigital && card.frontImageUrl) {
              // Send digital card email with the card image
              const emailParams = generateDigitalCardEmail(order, card.frontImageUrl);
              await sendEmail(emailParams);
              console.log('Digital card email sent successfully');
            }
          } catch (emailError) {
            console.error('Failed to send digital card email:', emailError);
          }
        }

        return res.json({
          ...updatedOrder,
          card,
          status: 'success',
          message: 'Payment verified successfully (test mode)'
        });
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.status && verifyData.data.status === 'success') {
        const updatedOrder = await storage.updateOrder(order.id, {
          paymentStatus: 'successful',
          orderStatus: order.shippingAddress ? 'processing' : 'completed'
        });

        const card = await storage.getCard(order.cardId);

        if (card) {
          await storage.updateCard(card.id, { status: 'paid' });

          // Send appropriate email based on order type
          try {
            const isDigital = !order.shippingAddress;
            if (isDigital && card.frontImageUrl) {
              // Send digital card email with the card image
              const emailParams = generateDigitalCardEmail(order, card.frontImageUrl);
              await sendEmail(emailParams);
              console.log('Digital card email sent successfully');
            }
          } catch (emailError) {
            console.error('Failed to send digital card email:', emailError);
          }
        }

        res.json({
          ...updatedOrder,
          card,
          status: 'success',
          message: 'Payment verified successfully'
        });
      } else {
        await storage.updateOrder(order.id, {
          paymentStatus: 'failed'
        });

        res.status(400).json({
          message: 'Payment verification failed',
          status: 'failed'
        });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error verifying payment: " + error.message });
    }
  });


  app.get("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const card = await storage.getCard(order.cardId);

      res.json({
        ...order,
        card
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });


  app.get("/api/orders", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const orders = await storage.getOrdersByEmail(email as string);

      const ordersWithCards = await Promise.all(
        orders.map(async (order) => {
          const card = await storage.getCard(order.cardId);
          return { ...order, card };
        })
      );

      res.json(ordersWithCards);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

}
