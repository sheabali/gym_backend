export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Gym Management System API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for a single-tenant Gym Management System in Bangladesh, built with Node.js, Express, TypeScript, and MongoDB (via Prisma ORM). Features atomic bookings, SSLCommerz hosted payments, subscription stacking, and role-based access control.',
    contact: {
      name: 'Gym Support',
      email: 'support@gym.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current API Environment',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your short-lived JWT access token in the Authorization header (e.g. Bearer <token>)',
      },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Operation succeeded' },
          data: { type: 'object' },
        },
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'BAD_REQUEST' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Role: {
        type: 'string',
        enum: ['MEMBER', 'TRAINER', 'ADMIN'],
      },
      UserStatus: {
        type: 'string',
        enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
      },
      SubscriptionStatus: {
        type: 'string',
        enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
      },
      PaymentStatus: {
        type: 'string',
        enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
      },
      Difficulty: {
        type: 'string',
        enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'],
      },
      BookingStatus: {
        type: 'string',
        enum: ['BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW'],
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Server and database health monitoring' },
    { name: 'Auth', description: 'Authentication, registration, JWT tokens, and sessions' },
    { name: 'Plans', description: 'Membership plans catalog with snapshot pricing' },
    { name: 'Trainers', description: 'Trainer public profiles and directory' },
    { name: 'Classes', description: 'Class types catalog and scheduled sessions timetable' },
    { name: 'Bookings', description: 'Atomic bookings engine, cancellation rules, and attendance' },
    { name: 'Subscriptions', description: 'Member subscription checkout, history, and stacking renewals' },
    { name: 'Payments', description: 'SSLCommerz payment gateway callbacks, IPN, and reconciliation' },
    { name: 'Admin', description: 'Overview dashboard metrics and member moderation' },
    { name: 'Content', description: 'FAQs, announcements, and facility gallery' },
    { name: 'Contact', description: 'Public inquiries and admin message inbox' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API and Database Health',
        responses: {
          '200': {
            description: 'System is healthy and database is connected',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } },
          },
          '503': {
            description: 'System or database is unhealthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new member',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'password'],
                properties: {
                  name: { type: 'string', example: 'Rahim Khan' },
                  email: { type: 'string', format: 'email', example: 'rahim@example.com' },
                  phone: { type: 'string', example: '01712345678' },
                  password: { type: 'string', minLength: 8, example: 'StrongP@ssw0rd' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Member registered successfully' },
          '400': { description: 'Validation failed' },
          '409': { description: 'Email or phone already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with credentials',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'member@gym.com' },
                  password: { type: 'string', example: 'MemberPassword123!' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful, returns accessToken and sets httpOnly refresh cookie' },
          '401': { description: 'Invalid email or password' },
          '403': { description: 'Account suspended or deactivated' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue new access token',
        responses: {
          '200': { description: 'Token refreshed successfully' },
          '401': { description: 'Invalid, missing, or compromised refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out current session and revoke refresh token',
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Profile retrieved' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/plans': {
      get: {
        tags: ['Plans'],
        summary: 'List active membership plans',
        responses: {
          '200': { description: 'List of plans sorted by sortOrder' },
        },
      },
      post: {
        tags: ['Plans'],
        summary: 'Create a membership plan (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price', 'durationDays'],
                properties: {
                  name: { type: 'string', example: 'Pro Quarterly' },
                  description: { type: 'string' },
                  price: { type: 'integer', description: 'Price in paisa (1 BDT = 100 paisa)', example: 800000 },
                  durationDays: { type: 'integer', example: 90 },
                  features: { type: 'array', items: { type: 'string' } },
                  isFeatured: { type: 'boolean' },
                  sortOrder: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Plan created' },
          '403': { description: 'Forbidden - Admin only' },
        },
      },
    },
    '/plans/{slug}': {
      get: {
        tags: ['Plans'],
        summary: 'Get membership plan details by slug or ID',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Plan details' },
          '404': { description: 'Plan not found' },
        },
      },
    },
    '/trainers': {
      get: {
        tags: ['Trainers'],
        summary: 'List public active trainers',
        responses: {
          '200': { description: 'List of trainers with public profiles' },
        },
      },
      post: {
        tags: ['Trainers'],
        summary: 'Create a new trainer account & profile (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '201': { description: 'Trainer created' },
        },
      },
    },
    '/classes/types': {
      get: {
        tags: ['Classes'],
        summary: 'List class templates',
        responses: {
          '200': { description: 'List of class types' },
        },
      },
      post: {
        tags: ['Classes'],
        summary: 'Create a class type template (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '201': { description: 'Class type created' },
        },
      },
    },
    '/classes/sessions': {
      get: {
        tags: ['Classes'],
        summary: 'Query scheduled class sessions',
        parameters: [
          { name: 'trainerId', in: 'query', schema: { type: 'string' } },
          { name: 'classTypeId', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': { description: 'Queryable sessions timetable' },
        },
      },
      post: {
        tags: ['Classes'],
        summary: 'Schedule a concrete class session (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '201': { description: 'Session scheduled' },
        },
      },
    },
    '/classes/sessions/recurring': {
      post: {
        tags: ['Classes'],
        summary: 'Generate weekly recurring class schedule (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '201': { description: 'Recurring sessions generated' },
        },
      },
    },
    '/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Book a class session with atomic capacity check (Member)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                  sessionId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Session booked' },
          '403': { description: 'Subscription required or free trial already used' },
          '409': { description: 'Class is full or session already booked' },
        },
      },
    },
    '/bookings/my': {
      get: {
        tags: ['Bookings'],
        summary: 'Get current member bookings history',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Personal bookings history' },
        },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel class booking (2-hour free cutoff rule)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Booking cancelled' },
        },
      },
    },
    '/bookings/{id}/attendance': {
      patch: {
        tags: ['Bookings'],
        summary: 'Mark class attendance (Trainer or Admin)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['ATTENDED', 'NO_SHOW'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Attendance updated' },
        },
      },
    },
    '/subscriptions/checkout': {
      post: {
        tags: ['Subscriptions'],
        summary: 'Initiate hosted checkout session with snapshot pricing',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['planId'],
                properties: {
                  planId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Checkout initiated, returns gatewayPageURL and tranId' },
        },
      },
    },
    '/subscriptions/my': {
      get: {
        tags: ['Subscriptions'],
        summary: 'Get current member subscriptions history',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Subscriptions history' },
        },
      },
    },
    '/subscriptions/admin-record': {
      post: {
        tags: ['Subscriptions'],
        summary: 'Record offline cash membership purchase (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '201': { description: 'Cash payment recorded and subscription activated' },
        },
      },
    },
    '/payments/{tranId}/status': {
      get: {
        tags: ['Payments'],
        summary: 'Check payment verification status by tranId',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tranId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Payment and subscription status' },
        },
      },
    },
    '/payments/sslcommerz/success': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz gateway browser POST redirect on success',
        responses: {
          '200': { description: 'Payment verified and subscription activated' },
          '302': { description: 'Redirects browser to frontend result page' },
        },
      },
    },
    '/payments/sslcommerz/ipn': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz server-to-server IPN webhook callback',
        responses: {
          '200': { description: 'IPN processed idempotently' },
        },
      },
    },
    '/payments/reconcile': {
      post: {
        tags: ['Payments'],
        summary: 'Reconcile stale PENDING payments against gateway (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Reconciliation summary' },
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Get dashboard summary metrics (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Metrics overview' },
        },
      },
    },
    '/admin/members': {
      get: {
        tags: ['Admin'],
        summary: 'List and filter member directory (Admin)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] } },
          { name: 'hasActiveSubscription', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Members directory' },
        },
      },
    },
    '/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Submit a public contact message / inquiry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'message'],
                properties: {
                  name: { type: 'string', example: 'Tanvir Hasan' },
                  email: { type: 'string', format: 'email', example: 'tanvir@example.com' },
                  phone: { type: 'string', example: '01712345678' },
                  message: { type: 'string', example: 'Inquiring about personal trainer rates.' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Message submitted successfully' },
        },
      },
      get: {
        tags: ['Contact'],
        summary: 'List contact inquiries (Admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Contact inbox list' },
        },
      },
    },
    '/content/faq': {
      get: {
        tags: ['Content'],
        summary: 'List FAQs',
        responses: {
          '200': { description: 'Frequently asked questions' },
        },
      },
    },
    '/content/announcements': {
      get: {
        tags: ['Content'],
        summary: 'List active announcements',
        responses: {
          '200': { description: 'Active announcements' },
        },
      },
    },
    '/content/gallery': {
      get: {
        tags: ['Content'],
        summary: 'List facility gallery images',
        responses: {
          '200': { description: 'Gallery images' },
        },
      },
    },
  },
};
