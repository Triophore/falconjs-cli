module.exports.settings = {
  name: "falcon-app",
  http: {
    host: process.env.HTTP_HOST || "localhost",
    port: process.env.HTTP_PORT || 3000
  },
  database: {
    mongodb: {
      database: process.env.MONGODB_URL || "mongodb://localhost:27017/falcon_db"
    }
  },
  mqtt: {
    internal: true,
    external: false
  },
  log: {
    appenders: {
      file: {
        type: "file",
        filename: process.env.LOG_FILE_NAME || "logs/app.log",
        maxLogSize: process.env.LOG_MAX_SIZE || "10M",
        backups: 3
      },
      console: {
        type: "console"
      }
    },
    categories: {
      default: {
        appenders: ["file", "console"],
        level: process.env.LOG_LEVEL || "info"
      }
    }
  },
  swagger: {
    enabled: true,
    path: "/documentation"
  },
  auth: {
    // Custom Authentication (API Keys, etc.)
    custom: {
      name: 'api-key',
      validate: async (token, request, context) => {
        // Custom validation logic with access to context (logger, redis, models)
        context.logger.info('Validating API key');
        
        // Check cache first
        const cacheKey = `api-key:${token}`;
        if (context.redis) {
          const cached = await context.redis.get(cacheKey);
          if (cached) return JSON.parse(cached);
        }
        
        // Validate against database or external service
        if (context.models.apiKey) {
          const apiKey = await context.models.apiKey.findOne({ key: token, active: true });
          if (apiKey) {
            const user = { id: apiKey.userId, roles: apiKey.roles };
            // Cache for 5 minutes
            if (context.redis) {
              await context.redis.setEx(cacheKey, 300, JSON.stringify(user));
            }
            return user;
          }
        }
        
        return null;
      },
      extractToken: (request) => {
        // Custom token extraction
        return request.headers['x-api-key'] || request.query.apiKey;
      }
    },
    
    // JWT Authentication
    jwt: {
      secret: process.env.JWT_SECRET || "your-secret-key-here",
      algorithms: ['HS256'],
      cache: {
        enabled: true,
        ttl: 300 // 5 minutes
      },
      validate: async (decoded, request, context) => {
        context.logger.info(`JWT validation for user: ${decoded.sub}`);
        
        // Check if user exists and is active
        if (context.models.user) {
          const user = await context.models.user.findById(decoded.sub).select('-password');
          if (user && user.active) {
            return {
              id: user._id,
              email: user.email,
              roles: user.roles || ['user']
            };
          }
        }
        
        // Fallback for development
        return {
          id: decoded.sub,
          email: decoded.email,
          roles: decoded.roles || ['user']
        };
      }
    },
    
    // Cookie Authentication
    cookie: {
      password: process.env.COOKIE_SECRET || "your-32-char-cookie-password-here",
      name: "falcon-session",
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      isSecure: process.env.NODE_ENV === "production",
      isHttpOnly: true,
      validate: async (request, session, context) => {
        context.logger.info(`Session validation for user: ${session.userId}`);
        
        if (context.models.user) {
          const user = await context.models.user.findById(session.userId).select('-password');
          if (user && user.active) {
            return {
              id: user._id,
              email: user.email,
              roles: user.roles || ['user']
            };
          }
        }
        
        return session.user;
      }
    },
    
    // JWKS Authentication (External Identity Providers)
    jwks: {
      jwksUri: process.env.JWKS_URI || "https://your-auth0-domain/.well-known/jwks.json",
      issuer: process.env.JWT_ISSUER || "https://your-auth0-domain/",
      audience: process.env.JWT_AUDIENCE || "your-api-identifier",
      algorithms: ['RS256'],
      cache: {
        enabled: true,
        ttl: 3600 // 1 hour
      },
      validate: async (decoded, request, context) => {
        context.logger.info(`JWKS validation for user: ${decoded.sub}`);
        
        // Map external identity to internal user
        if (context.models.user) {
          let user = await context.models.user.findOne({ externalId: decoded.sub });
          
          if (!user && decoded.email) {
            // Create user if doesn't exist
            user = await context.models.user.create({
              externalId: decoded.sub,
              email: decoded.email,
              name: decoded.name,
              roles: ['user'],
              active: true
            });
          }
          
          if (user) {
            return {
              id: user._id,
              email: user.email,
              roles: user.roles || ['user']
            };
          }
        }
        
        // Fallback
        return {
          id: decoded.sub,
          email: decoded.email,
          roles: decoded['https://yourapp.com/roles'] || ['user']
        };
      }
    },
    
    // Socket.IO Configuration
    socketio: {
      enabled: true,
      timeout: 5000
    }
  },
  services: [],
  workers: [],
  models: [],
  routes: [],
  crud: {
    exclude: []
  },
  postInit: "post"
};