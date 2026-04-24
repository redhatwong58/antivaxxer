/**
 * NextAuth shared options — ANTIVAXXER
 *
 * [AV-049] v5.3.5 — extracted authOptions into a shared module so server
 *   components (like the admin layout) can call `getServerSession(authOptions)`
 *   without importing from the route handler file (which would create a
 *   circular import in Next.js App Router).
 *
 * Source of truth for NextAuth configuration. The route handler at
 * `src/app/api/auth/[...nextauth]/route.js` re-exports this object as
 * the handler config.
 */

import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        turnstileToken: { label: 'Turnstile', type: 'text' }, // [AV-065] v5.4.6
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              turnstileToken: credentials.turnstileToken || '', // [AV-065] v5.4.6
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          if (!data.user) return null;

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            apiToken: data.apiToken, // Signed JWT from Express API
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/account/login',
    error: '/account/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.apiToken = user.apiToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.apiToken = token.apiToken;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
