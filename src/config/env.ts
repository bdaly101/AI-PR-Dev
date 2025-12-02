import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  github: {
    appId: string;
    privateKey: string;
    webhookSecret: string;
  };
  openai: {
    apiKey: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    path: string;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export const config: Config = {
  github: {
    appId: getEnvVar('GITHUB_APP_ID'),
    privateKey: getEnvVar('GITHUB_PRIVATE_KEY').replace(/\\n/g, '\n'),
    webhookSecret: getEnvVar('GITHUB_WEBHOOK_SECRET'),
  },
  openai: {
    apiKey: getEnvVar('OPENAI_API_KEY'),
  },
  server: {
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
  },
  database: {
    path: getEnvVar('DATABASE_PATH', './data/app.db'),
  },
};
