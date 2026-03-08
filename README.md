# Storyteller

A Node.js backend project with TypeScript.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
npm install
```

### Development

To run the project in development mode:

```bash
npm run dev
```

To watch for changes and recompile:

```bash
npm run watch
```

### Building

To compile TypeScript to JavaScript:

```bash
npm run build
```

### Running

To run the compiled project:

```bash
npm start
```

## Docker

### Prerequisites

- Docker
- Docker Compose

### Running with Docker Compose

```bash
docker-compose up --build
```

The app will be available at `http://localhost:3000`.

To run in detached mode:

```bash
docker-compose up -d --build
```

To stop:

```bash
docker-compose down
```

To rebuild the image:

```bash
docker-compose build --no-cache
```

## Project Structure

```
src/
  index.ts          - Entry point
dist/               - Compiled JavaScript (generated)
Dockerfile          - Docker image configuration
docker-compose.yml  - Docker Compose configuration
```

## License

ISC
