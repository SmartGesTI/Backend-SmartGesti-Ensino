export interface Auth0User {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}
