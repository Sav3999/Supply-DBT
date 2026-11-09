import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authorizeCredentials } from "@/server/auth/credentials";
import { AppError } from "@/lib/result";

/** Carries the Thai message in `code` so the login action can show it. */
export class ThaiCredentialsError extends CredentialsSignin {
  constructor(message: string) {
    super();
    this.code = message;
  }
}

export { AuthError };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        try {
          return await authorizeCredentials(email, password);
        } catch (e) {
          if (e instanceof AppError) throw new ThaiCredentialsError(e.message);
          throw e;
        }
      },
    }),
  ],
});
