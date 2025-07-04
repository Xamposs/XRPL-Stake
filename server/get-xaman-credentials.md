# How to Get Xaman (XUMM) API Credentials

To use the XRP-FLR staking application, you need to obtain API credentials from the Xaman Developer Console. Follow these steps:

## Step 1: Create a Xaman Developer Account

1. Go to the [Xaman Developer Console](https://apps.xumm.dev/)
2. Sign up for an account if you don't have one already
3. Log in to your account

## Step 2: Create a New Application

1. Click on "Add an application" or navigate to the Applications section
2. Fill in the required information:
   - **Name**: XRP-FLR Staking App
   - **Description**: An application for staking XRP and earning Flare rewards
   - **Icon**: Upload an icon (optional)
   - **Website URL**: Your website URL or localhost (e.g., http://localhost:3000)
   - **Redirect URLs**: Add http://localhost:3000/auth/callback

## Step 3: Get Your API Credentials

1. After creating the application, you'll be provided with:
   - **API Key**: Your public API key
   - **API Secret**: Your private API secret

## Step 4: Add Credentials to Your .env Files

1. In the `server/.env` file:
   ```
   XAMAN_API_KEY=your_api_key_here
   XAMAN_API_SECRET=your_api_secret_here
   ```

2. In the root `.env` file (for the frontend):
   ```
   VITE_XAMAN_API_KEY=your_api_key_here
   VITE_XAMAN_API_SECRET=your_api_secret_here
   ```

## Important Notes

- **Never share your API Secret** with anyone or commit it to public repositories
- The API Key and Secret are used to authenticate your application with the Xaman platform
- If you suspect your credentials have been compromised, you can regenerate them in the Xaman Developer Console
