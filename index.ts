import path from 'path';

import cors from 'cors';
import express from 'express';

import corsOptions from './src/config/cors.js';
import { connectDB } from './src/config/database.js';
import env from './src/config/env.js';
import { initializeSystem } from './src/config/initialSetup.js';
import { notFound, errorHandler } from './src/middlewares/error.middleware.js';
import mainRouter from './src/routes/main.routes.js';
import logger from './src/utils/logger.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.NODE_ENV === 'production'
  ? (env.PORT_PROD || env.PORT)
  : (env.PORT_DEV || env.PORT);

app.use(express.json());
app.use(cors(corsOptions));
app.use('/api', mainRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();
    await initializeSystem();
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error({ error }, 'System initialization failed');
    process.exit(1);
  }
}

startServer();

export default app;
