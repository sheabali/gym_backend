import { Router, Request, Response } from 'express';
import { openapiSpec } from './openapiSpec';
import { renderSwaggerHtml } from './swaggerHtml';

export const docsRouter = Router();

// Returns raw OpenAPI 3.0 JSON specification
docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openapiSpec);
});

// Serves the interactive Swagger UI
docsRouter.get('/', (req: Request, res: Response) => {
  const baseUrl = req.baseUrl || '/api-docs';
  const specUrl = `${baseUrl}/openapi.json`;
  res.setHeader('Content-Type', 'text/html');
  res.send(renderSwaggerHtml(specUrl));
});
