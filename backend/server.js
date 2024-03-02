const express = require("express");
const app = express();
const stripe = require("stripe")( "sk_test_51JemJrDRZK0BHB8aNDvimfdbD8bd0hliFa9ghP2XUbHMpak4pP03LteHCP1Igtz1k2VhQm3X0ygukYu7MMn8nX5L00yKfA5tnP");
const cors = require('cors');

app.use(cors());
app.use(express.json());




let generatedAccountId = null;

const calculateTax = async (items, currency) => {
  const taxCalculation = await stripe.tax.calculations.create({
    currency,
    customer_details: {
      address: {
        line1: "Example Street",
        city: "California",
        state: "CA",
        postal_code: "90007",
        country: "US",
      },
      address_source: "shipping",
    },
    line_items: items.map((item) => buildLineItem(item)),
  });

  return taxCalculation;
};

const buildLineItem = (item) => {
  return {
    amount: item.amount, 
    reference: item.id, 
  };
};

const calculateOrderAmount = (items, taxCalculation) => {
  let orderAmount = 4500;
  orderAmount += taxCalculation.tax_amount_exclusive;
  return orderAmount;
};

app.post("/create-payment-intent", async (req, res) => {
  const { items } = req.body;
  const taxCalculation = await calculateTax(items, "usd");
  const amount = await calculateOrderAmount(items, taxCalculation);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      tax_calculation: taxCalculation.id,
    },
  });

  res.json({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post('/generate-account-link', async (req, res) => {
  try {
    const account = await stripe.accounts.create({ type: 'express' });
    generatedAccountId = account.id;

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'http://localhost:3000/formpage',
      return_url: 'http://localhost:3000/return',
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Error generating account link:', err.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.post('/create-login-link', async (req, res) => {
  try {
    if (!generatedAccountId) {
      throw new Error('Account ID not generated');
    }

    const loginLink = await stripe.accounts.createLoginLink(generatedAccountId);
    res.json({ url: loginLink.url });
  } catch (err) {
    console.error('Error generating login link:', err.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});
app.post('/create-checkout-session', async (req, res) => {
  try {
    

    // Fetch product details from your database or other source
    const product2 = await stripe.products.create({
      name:'laptop',
      });
    const plan1 = await stripe.plans.create({
      amount: 1200,
      currency: 'usd',
      interval: 'month',
      product: product2.id,
    });


    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      
      line_items: [
        {
          price: plan1.id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel', // Replace with your cancel URL
     
      
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating Checkout Session:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/create-customer-subscriptions', async (req, res) => {
  try {
    // Create a new customer
    const customer = await stripe.customers.create({
      name: 'crabroom',
      email: 'crabroom@example.com',
      
    });
    const customerSource = await stripe.customers.createSource(
      customer.id,
      {
        source: 'tok_visa',
      }
    );

    
    const product1 = await stripe.products.create({
    name: 'Gold Plan',
    });
    const product2 = await stripe.products.create({
      name: 'waterbottle',
      });
    const plan1 = await stripe.plans.create({
      amount: 1200,
      currency: 'usd',
      interval: 'month',
      product: product1.id,
    });
    const plan2 = await stripe.plans.create({
      amount: 1200,
      currency: 'usd',
      interval: 'month',
      product: product2.id,
    });
    // Create two subscription plans (replace with your actual plan IDs)
    const planId1 = plan1.id;
    const planId2 = plan2.id;

    // Subscribe the customer to the first plan
    const subscription1 = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planId1 }],
    });

    // Subscribe the customer to the second plan
    const subscription2 = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planId2 }],
    });

    res.json({ customerId: customer.id, subscriptions: [subscription1, subscription2] });
  } catch (error) {
    console.error('Error creating customer and subscriptions:', error);
    res.status(500).json({ error: 'Error creating customer and subscriptions' });
  }
});

app.get('/open-billing-portal', async (req, res) => {
  const { customerId } = req.query;


  try {
    const product3 = await stripe.products.create({
      name: 'glass',
      });
    
    const plan3 = await stripe.plans.create({
      amount: 1400,
      currency: 'usd',
      interval: 'month',
      product: product3.id,
    });
      
    const configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline:'Welcome to customer portal',
        privacy_policy_url: 'https://example.com/privacy',
        terms_of_service_url: 'https://example.com/terms',
      },
      features: {
        customer_update: {
          allowed_updates: ['name','email','address'],
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
        
        subscription_pause: {
          enabled: true,
        },
        subscription_cancel: {
          enabled: true,
        },
        payment_method_update: {
          enabled: true,
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: [ 'price'],
          products: [
            {
              product: product3.id,
              prices: [plan3.id],
            },
          ],
        },
      },
    });
    const customer = await stripe.customers.retrieve(customerId);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration:configuration.id,
      return_url: 'http://localhost:3000/customer-steps', // Replace with your actual deployment URL
    });

    res.json({ redirectUrl: session.url });
  } catch (error) {
    console.error('Error opening Billing Portal:', error);
    res.status(500).json({ error: 'Error opening Billing Portal' });
  }
});

app.listen(3001, () => {
  console.log('Backend server is running on port 3001');
});
