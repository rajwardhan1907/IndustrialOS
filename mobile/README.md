# IndustrialOS Mobile App (Phase 21)

React Native / Expo app for warehouse workers. Shares the same API layer as the web dashboard.

## Screens

| Tab | Description |
|---|---|
| Dashboard | Key metrics (open orders, low stock, revenue) + active alerts |
| Inventory | Stock list with search + barcode scanning. Tap any item to update stock level. |
| Orders | Orders grouped by stage. Advance stage with one tap. |
| Shipments | Shipment tracking. Update delivery status in the field. |
| Alerts | Push notification history. Tap to mark read. |

## Setup

```bash
cd mobile
npm install

# Copy env file and set your deployed URL
cp .env.example .env.local
```

Edit `.env.local`:
```
EXPO_PUBLIC_API_URL=https://industrial-os.vercel.app
```

For local dev:
```
EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000
```

## Run

```bash
# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator / device
npm run android
```

## Build for distribution

```bash
# Install EAS CLI
npm install -g eas-cli

# Build
eas build --platform all
```

## Push Notifications

Push notifications are powered by Expo Notifications. The app registers a push token on login and sends it to `/api/notifications/push-token` on your web server.

Alerts for low stock, new orders, and overdue invoices are sent from the web app's existing notification system.

## Login

Use the same email and password you set up on the web dashboard. The mobile app calls `/api/auth/mobile-token` which verifies your credentials and returns a session token stored in SecureStore.
