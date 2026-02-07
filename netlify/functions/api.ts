import serverless from 'serverless-http';
import { app } from '../../backend/app';

export const handler = serverless(app);
