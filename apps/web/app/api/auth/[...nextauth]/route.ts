import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      // Exchange Google token for BFF JWT on first sign-in
      if (account?.access_token) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BFF_URL}/api/v1/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ googleToken: account.access_token }),
          });
          if (res.ok) {
            const { token: bffToken } = await res.json();
            token.bffToken = bffToken;
          }
        } catch {
          // BFF exchange failed — session still valid for UI, API calls will 401
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).bffToken = token.bffToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
