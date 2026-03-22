export type AuthType = 'login' | 'oauth2';

export interface EmailAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  smtpHost?: string;
  smtpPort?: number;
  user: string;
  authType: AuthType;
  useTLS: boolean;
}

export interface Credentials {
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}
