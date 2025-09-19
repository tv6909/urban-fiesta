# HZ Shop Management System

## Overview

HZ Shop Management is a comprehensive retail management solution built with Next.js 14, featuring offline-first capabilities and progressive web app (PWA) functionality. The application provides complete inventory management, sales tracking, customer management, and reporting capabilities with role-based access control. It's designed to work seamlessly both online and offline, making it suitable for retail environments with varying connectivity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 14 with App Router for server-side rendering and routing
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React hooks and context for client-side state
- **PWA Features**: Service worker implementation for offline functionality and app installation

### Authentication & Authorization
- **Provider**: Supabase Auth for user authentication
- **Role System**: Multi-tier role-based access control (admin, seller, viewer)
- **Session Management**: Server-side session handling with middleware
- **Permission Structure**: Granular permissions for different application features

### Data Architecture
- **Primary Database**: Supabase (PostgreSQL) for production data
- **Offline Storage**: IndexedDB for local data persistence and offline operation
- **Sync Strategy**: Bidirectional sync manager for online/offline data synchronization
- **Data Models**: Comprehensive schema for products, categories, receipts, returns, and user management

### Key Features Architecture
- **Inventory Management**: Product and category management with stock tracking
- **Sales Processing**: Receipt generation with customer and shopkeeper management
- **Return Handling**: Product return processing and approval workflow
- **Reporting**: Dashboard metrics and business intelligence
- **Offline Support**: Full CRUD operations available offline with automatic sync

### Component Architecture
- **Layout System**: Responsive sidebar and bottom navigation for mobile/desktop
- **Modal System**: Reusable modal components for forms and details
- **Page Components**: Feature-specific pages with dedicated components
- **UI Components**: Consistent design system with Radix UI primitives

### Mobile & PWA Features
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Installation**: Web app manifest for native app-like installation
- **Offline Mode**: Full functionality without internet connection
- **Service Worker**: Caching strategy for offline resource availability

## External Dependencies

### Core Services
- **Supabase**: Primary database, authentication, and real-time subscriptions
- **Vercel Analytics**: Application performance monitoring and usage analytics

### Development Tools
- **TypeScript**: Type safety and enhanced developer experience
- **Tailwind CSS**: Utility-first styling framework
- **shadcn/ui**: Pre-built component library based on Radix UI

### UI & Interaction Libraries
- **Radix UI**: Accessible, unstyled UI primitives for complex components
- **Lucide React**: Icon library for consistent iconography
- **React Hook Form**: Form state management and validation
- **Embla Carousel**: Touch-friendly carousel component

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **jsPDF**: Client-side PDF generation for receipts
- **class-variance-authority**: Type-safe CSS class variants
- **clsx/tailwind-merge**: Conditional CSS class management

### Fonts & Design
- **Geist**: Modern font family (sans and mono variants)
- **CSS Variables**: Custom properties for theme customization

### Browser APIs
- **IndexedDB**: Local database for offline storage
- **Service Workers**: Background sync and caching
- **Web App Manifest**: PWA installation and configuration
- **Navigator API**: Online/offline status detection