# Falcon CLI

Command-line interface for creating and managing Falcon.js applications.

## Installation

```bash
npm install -g falcon-cli
```

## Usage

### Create a new project
```bash
falcon-cli create my-app
falcon-cli create my-app --template api
falcon-cli create my-app --skip-install
```

### Generate components
```bash
# Generate a model
falcon-cli generate model User
falcon-cli g model Product --crud

# Generate a route
falcon-cli generate route users

# Generate a service
falcon-cli generate service email

# Generate a worker
falcon-cli generate worker image-processor
```

## Commands

- `create [name]` - Create a new Falcon.js project
- `generate <type> [name]` - Generate project components
  - Types: `model`, `route`, `service`, `worker`, `validator`

## Options

- `--verbose, -V` - Run with verbose logging
- `--help, -h` - Show help
- `--version, -v` - Show version

## Project Structure

```
my-falcon-app/
├── index.js              # Application entry point
├── settings.js           # Falcon configuration
├── .env                  # Environment variables
├── models/mongo/         # Mongoose models
├── routes/               # API routes
├── services/             # Background services
├── workers/              # Job processors
├── validators/           # Joi validation schemas
├── init/                 # Initialization scripts
└── logs/                 # Application logs
```
