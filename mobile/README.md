# Zensbot LMS — Mobile App

Student-only React Native (Expo) mobile app for the ICT LMS platform. Android-first, iOS-compatible.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli` or use `npx expo`)
- Android Studio with emulator **or** physical Android device with Expo Go
- Git

## Setup

```bash
cd mobile
npm install
npx expo start            # Start dev server (QR code for Expo Go)
npx expo start --android  # Launch on connected Android emulator/device
npx expo run:android      # Native build (requires Android SDK)
```

## Scripts

| Script | Command |
|--------|---------|
| Start dev server | `npm start` |
| Android | `npm run android` |
| iOS | `npm run ios` |
| Web (debug only) | `npm run web` |

## API

All API calls go to `https://apiict.zensbot.site/api/v1`. This is the same backend that powers the web frontend at `https://zensbot.online`.

## Folder Structure

```
mobile/
├── app/                    # Expo Router file-based routes
│   ├── (auth)/             # Login + biometric unlock screens
│   └── (tabs)/             # Bottom tab navigator
│       ├── home/           # Dashboard
│       ├── courses/        # Course list → detail → video player
│       ├── classes/        # Zoom classes → recordings
│       ├── notifications/  # Notification list
│       └── profile/        # Settings, certificates, jobs
├── lib/                    # Core libraries
│   ├── api/                # API client + endpoint modules
│   ├── contexts/           # React Context providers
│   ├── hooks/              # Custom hooks (useApi, useMutation, etc.)
│   ├── utils/              # Helpers (case-convert, storage, etc.)
│   ├── types/              # TypeScript interfaces
│   └── constants/          # Config, colors, icons
├── components/             # Reusable components
│   ├── ui/                 # Primitives (Button, Card, TextInput, etc.)
│   ├── shared/             # Composites (VideoPlayer, CourseCard, etc.)
│   └── layout/             # TabBarIcon, etc.
└── assets/                 # Icons, splash, fonts
```

## Architecture & Conventions

See **[CLAUDE.md](./CLAUDE.md)** for the complete architecture guide, API endpoint reference, implementation phases, and coding conventions.
